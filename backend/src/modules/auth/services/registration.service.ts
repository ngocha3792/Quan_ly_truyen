import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { InvalidInputException, isAppException } from '@/common/exceptions';
import { generateSecureToken, hashPassword, sha256 } from '@/common/utils';
import type { MailConfig } from '@/config';
import { TokenType } from '@/generated/prisma/client';
import { PrismaService } from '@/infrastructure/database/prisma';
import { mapPrismaError } from '@/infrastructure/database/prisma/prisma-error.mapper';
import { MailTemplateId } from '@/infrastructure/mail/templates';
import { SEND_MAIL_JOB } from '@/infrastructure/queue/contracts';
import { OutboxWriterService } from '@/infrastructure/queue/outbox/outbox-writer.service';

import type { RegisterDto, RegisterResponseDto } from '../dto/register.dto';

const EMAIL_VERIFICATION_TTL_MINUTES = 30;

@Injectable()
export class RegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxWriter: OutboxWriterService,
    private readonly configService: ConfigService,
  ) {}

  async register(input: RegisterDto): Promise<RegisterResponseDto> {
    let passwordHash: string;
    try {
      passwordHash = await hashPassword(input.password);
    } catch (error: unknown) {
      throw new InvalidInputException({
        message: 'Mật khẩu không hợp lệ',
        cause: error,
      });
    }

    const rawVerificationToken = generateSecureToken();
    const verificationTokenHash = sha256(rawVerificationToken);
    const verificationExpiresAt = new Date(
      Date.now() + EMAIL_VERIFICATION_TTL_MINUTES * 60_000,
    );
    const mailConfig = this.configService.getOrThrow<MailConfig>('mail');

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: input.email.trim().toLowerCase(),
            username: input.username.trim(),
            passwordHash,
            displayName: input.displayName.trim(),
          },
          select: {
            id: true,
            email: true,
            username: true,
            displayName: true,
          },
        });
        const verification = await tx.userToken.create({
          data: {
            userId: user.id,
            type: TokenType.EMAIL_VERIFICATION,
            tokenHash: verificationTokenHash,
            expiresAt: verificationExpiresAt,
          },
          select: { id: true },
        });
        const verificationUrl = new URL(
          '/verify-email',
          mailConfig.frontendPublicUrl,
        );
        verificationUrl.searchParams.set('token', rawVerificationToken);

        await this.outboxWriter.create(tx, {
          aggregateType: 'mail',
          aggregateId: user.id,
          eventType: SEND_MAIL_JOB,
          idempotencyKey: `email-verification:${verification.id}`,
          payload: {
            version: 1,
            templateId: MailTemplateId.EMAIL_VERIFICATION,
            recipientEmail: user.email,
            variables: {
              displayName: user.displayName,
              verificationUrl: verificationUrl.toString(),
              expiresInMinutes: EMAIL_VERIFICATION_TTL_MINUTES,
            },
          },
        });

        return { ...user, verificationRequired: true as const };
      });
    } catch (error: unknown) {
      if (isAppException(error)) throw error;
      throw mapPrismaError(error, {
        operation: 'register-user-with-verification-outbox',
        resource: 'Tài khoản',
      });
    }
  }
}
