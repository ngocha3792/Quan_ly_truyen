import { Injectable } from '@nestjs/common';
import { EmailVerificationUrlBuilder } from '../../../mail';
import { RoleCode } from '@/common/enums';
import { isAppException } from '@/common/exceptions';
import { TokenType } from '@/generated/prisma/client';
import { mapPrismaError, PrismaService } from '@/infrastructure/database';
import { MailTemplateId } from '@/infrastructure/mail/templates';
import {
  SEND_MAIL_JOB,
  type SendMailJobV1,
} from '@/infrastructure/queue/contracts';
import { OutboxWriterService } from '@/infrastructure/queue/outbox/outbox-writer.service';

import type {
  RegistrationUnitOfWorkInput,
  RegistrationUnitOfWorkPort,
  RegistrationUnitOfWorkResult,
} from '../../../../application/ports';
import {
  DefaultRoleNotFoundException,
  EmailAlreadyInUseException,
  UsernameAlreadyInUseException,
} from '../../../../domain/exceptions';

@Injectable()
export class PrismaRegistrationUnitOfWork implements RegistrationUnitOfWorkPort {
  constructor(
    private readonly prisma: PrismaService,

    private readonly outboxWriter: OutboxWriterService,

    private readonly urlBuilder: EmailVerificationUrlBuilder,
  ) {}

  async execute(
    input: RegistrationUnitOfWorkInput,
  ): Promise<RegistrationUnitOfWorkResult> {
    const verificationUrl = this.urlBuilder.build(input.rawVerificationToken);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingUser = await tx.user.findFirst({
          where: {
            OR: [
              {
                email: {
                  equals: input.email,
                  mode: 'insensitive',
                },
              },
              {
                username: {
                  equals: input.username,
                  mode: 'insensitive',
                },
              },
            ],
          },
          select: {
            email: true,
            username: true,
          },
        });

        if (existingUser?.email.toLowerCase() === input.email.toLowerCase()) {
          throw new EmailAlreadyInUseException(input.email);
        }

        if (
          existingUser?.username.toLowerCase() === input.username.toLowerCase()
        ) {
          throw new UsernameAlreadyInUseException(input.username);
        }

        const defaultRole = await tx.role.findUnique({
          where: {
            code: RoleCode.USER,
          },
          select: {
            id: true,
          },
        });

        if (!defaultRole) {
          throw new DefaultRoleNotFoundException(RoleCode.USER);
        }

        const user = await tx.user.create({
          data: {
            email: input.email,
            username: input.username,
            passwordHash: input.passwordHash,
            displayName: input.displayName,
          },
          select: {
            id: true,
            email: true,
            username: true,
            displayName: true,
          },
        });

        await tx.userRole.create({
          data: {
            userId: user.id,
            roleId: defaultRole.id,
          },
        });

        const verificationToken = await tx.userToken.create({
          data: {
            userId: user.id,
            type: TokenType.EMAIL_VERIFICATION,
            tokenHash: input.verificationTokenHash,
            expiresAt: input.verificationExpiresAt,
          },
          select: {
            id: true,
          },
        });

        const mailPayload = {
          version: 1,
          templateId: MailTemplateId.EMAIL_VERIFICATION,
          recipientEmail: user.email,
          variables: {
            displayName: user.displayName,
            verificationUrl,
            expiresInMinutes: input.verificationExpiresInMinutes,
          },
        } satisfies SendMailJobV1;

        await this.outboxWriter.create(tx, {
          aggregateType: 'mail',
          aggregateId: user.id,
          eventType: SEND_MAIL_JOB,
          idempotencyKey: `email-verification:${verificationToken.id}`,
          payload: mailPayload,
        });

        return user;
      });
    } catch (error: unknown) {
      if (isAppException(error)) {
        throw error;
      }

      throw mapPrismaError(error, {
        operation: 'auth-register-user',
        resource: 'Tài khoản',
      });
    }
  }
}
