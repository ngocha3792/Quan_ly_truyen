import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { MailConfig } from '@/config';

import { MAIL_SENDER, type MailSenderPort } from '../contracts';
import { MailDeliveryException } from '../exceptions';
import { TemplateRendererService } from '../templates';

export interface DispatchMailInput {
  templateId: string;
  recipientEmail: string;
  variables: Record<string, unknown>;
  correlationId?: string;
  outboxEventId?: string;
}

@Injectable()
export class MailDispatchService {
  constructor(
    private readonly configService: ConfigService,
    private readonly renderer: TemplateRendererService,
    @Inject(MAIL_SENDER) private readonly sender: MailSenderPort,
  ) {}

  async dispatch(input: DispatchMailInput): Promise<void> {
    const config = this.configService.getOrThrow<MailConfig>('mail');
    if (!config.enabled) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.recipientEmail)) {
      throw new MailDeliveryException('Recipient email is invalid', false);
    }
    const rendered = this.renderer.render(input.templateId, input.variables);
    await this.sender.send({
      to: { address: input.recipientEmail },
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      tags: rendered.tags,
      correlationId: input.correlationId,
      idempotencyKey: input.outboxEventId,
      headers: input.outboxEventId
        ? { 'X-Outbox-Event-Id': input.outboxEventId }
        : undefined,
    });
  }
}
