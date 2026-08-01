import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Span } from '@opentelemetry/api';

import type { MailConfig } from '@/config';

import {
  MAIL_SENDER,
  type MailDispatchResult,
  type MailSenderPort,
} from '../contracts';
import { MailDeliveryException } from '../exceptions';
import { TemplateRendererService } from '../templates';
import {
  MANUAL_SPANS,
  MetricsService,
  TracingService,
} from '@/infrastructure/observability';

export interface DispatchMailInput {
  templateId: string;
  recipientEmail: string;
  variables: Record<string, unknown>;
  correlationId?: string;
  outboxEventId?: string;
}

export function createOutboxMessageId(
  outboxEventId: string,
  domain: string,
): string {
  return `<outbox-${outboxEventId}@${domain}>`;
}

@Injectable()
export class MailDispatchService {
  constructor(
    private readonly configService: ConfigService,
    private readonly renderer: TemplateRendererService,
    @Inject(MAIL_SENDER) private readonly sender: MailSenderPort,
    private readonly metrics: MetricsService,
    private readonly tracing: TracingService,
  ) {}

  async dispatch(input: DispatchMailInput): Promise<MailDispatchResult> {
    return this.tracing.inSpan(
      MANUAL_SPANS.MAIL_DISPATCH,
      { 'mail.template': input.templateId, 'rpc.system': 'smtp' },
      (span) => this.dispatchInternal(input, span),
    );
  }

  private async dispatchInternal(
    input: DispatchMailInput,
    span: Span,
  ): Promise<MailDispatchResult> {
    const startedAt = performance.now();
    const config = this.configService.getOrThrow<MailConfig>('mail');
    if (!config.enabled) {
      this.metrics.recordMail(
        input.templateId,
        'skipped',
        (performance.now() - startedAt) / 1000,
      );
      return { status: 'skipped', reason: 'mail-disabled' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.recipientEmail)) {
      throw new MailDeliveryException('Recipient email is invalid', false);
    }
    try {
      const rendered = this.renderer.render(input.templateId, input.variables);
      const result = await this.sender.send({
        to: { address: input.recipientEmail },
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
        messageId: input.outboxEventId
          ? createOutboxMessageId(input.outboxEventId, config.messageIdDomain)
          : undefined,
        tags: rendered.tags,
        correlationId: input.correlationId,
        idempotencyKey: input.outboxEventId,
        headers: input.outboxEventId
          ? { 'X-Outbox-Event-Id': input.outboxEventId }
          : undefined,
      });
      span.setAttribute('messaging.message.id', result.messageId);
      this.metrics.recordMail(
        input.templateId,
        'success',
        (performance.now() - startedAt) / 1000,
      );
      return {
        status: 'sent',
        messageId: result.messageId,
        accepted: result.accepted,
      };
    } catch (error: unknown) {
      this.metrics.recordMail(
        input.templateId,
        'failed',
        (performance.now() - startedAt) / 1000,
      );
      throw error;
    }
  }
}
