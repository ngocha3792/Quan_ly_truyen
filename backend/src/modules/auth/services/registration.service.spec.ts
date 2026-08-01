import { ConfigService } from '@nestjs/config';

import { InvalidInputException } from '@/common/exceptions';
import { TokenType } from '@/generated/prisma/client';
import { MailTemplateId } from '@/infrastructure/mail/templates';
import { SEND_MAIL_JOB } from '@/infrastructure/queue/contracts';

import { RegistrationService } from './registration.service';

describe('RegistrationService', () => {
  const user = {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'reader@example.test',
    username: 'reader_one',
    displayName: 'Reader One',
  };
  const tx = {
    user: { create: jest.fn() },
    userToken: { create: jest.fn() },
  };
  const prisma = { $transaction: jest.fn() };
  const outboxWriter = { create: jest.fn() };
  const service = new RegistrationService(
    prisma as never,
    outboxWriter as never,
    new ConfigService({
      mail: {
        frontendPublicUrl: 'https://reader.example.test',
      },
    }),
  );

  beforeEach(() => {
    jest.clearAllMocks();
    tx.user.create.mockResolvedValue(user);
    tx.userToken.create.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000002',
    });
    outboxWriter.create.mockResolvedValue({ id: 'outbox-1' });
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );
  });

  it('writes user, verification and versioned mail event in one transaction', async () => {
    await expect(service.register(validInput())).resolves.toEqual({
      ...user,
      verificationRequired: true,
    });

    const [tokenArgs] = tx.userToken.create.mock.calls[0] as unknown as [
      {
        data: {
          userId: string;
          type: TokenType;
          tokenHash: string;
          expiresAt: Date;
        };
      },
    ];
    expect(tokenArgs.data.userId).toBe(user.id);
    expect(tokenArgs.data.type).toBe(TokenType.EMAIL_VERIFICATION);
    expect(tokenArgs.data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenArgs.data.expiresAt).toBeInstanceOf(Date);

    const [writerTx, writerInput] = outboxWriter.create.mock
      .calls[0] as unknown as [
      typeof tx,
      {
        aggregateType: string;
        aggregateId: string;
        eventType: string;
        idempotencyKey: string;
        payload: {
          version: number;
          templateId: string;
          recipientEmail: string;
        };
      },
    ];
    expect(writerTx).toBe(tx);
    expect(writerInput).toMatchObject({
      aggregateType: 'mail',
      aggregateId: user.id,
      eventType: SEND_MAIL_JOB,
      idempotencyKey: 'email-verification:00000000-0000-4000-8000-000000000002',
    });
    expect(writerInput.payload).toMatchObject({
      version: 1,
      templateId: MailTemplateId.EMAIL_VERIFICATION,
      recipientEmail: user.email,
    });
    const payload = writerInput.payload;
    expect(JSON.stringify(payload)).not.toContain(validInput().password);
    expect(JSON.stringify(payload)).not.toContain('passwordHash');
  });

  it('rejects a password outside bcrypt byte limits before opening a transaction', async () => {
    await expect(
      service.register({ ...validInput(), password: 'A1!'.repeat(25) }),
    ).rejects.toBeInstanceOf(InvalidInputException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(outboxWriter.create).not.toHaveBeenCalled();
  });
});

function validInput() {
  return {
    email: 'reader@example.test',
    username: 'reader_one',
    password: 'StrongPassword1!',
    displayName: 'Reader One',
  };
}
