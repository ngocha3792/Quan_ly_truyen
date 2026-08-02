import { Inject, Injectable } from '@nestjs/common';

import {
  PASSWORD_HASHER_PORT,
  type PasswordHasherPort,
  REGISTRATION_UNIT_OF_WORK_PORT,
  type RegistrationUnitOfWorkPort,
  SECURE_TOKEN_PORT,
  type SecureTokenPort,
} from '../../ports';
import { RegisterResultMapper } from '../../mappers';
import type { RegisterResultDto } from '../../dto';
import {
  DisplayNameValueObject,
  EmailValueObject,
  PasswordValueObject,
  UsernameValueObject,
} from '../../../domain/value-objects';
import { EmailVerificationPolicy } from '../../../domain/policies';

import { RegisterCommand } from './register.command';

@Injectable()
export class RegisterCommandHandler {
  constructor(
    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: PasswordHasherPort,

    @Inject(SECURE_TOKEN_PORT)
    private readonly secureToken: SecureTokenPort,

    @Inject(REGISTRATION_UNIT_OF_WORK_PORT)
    private readonly registrationUnitOfWork: RegistrationUnitOfWorkPort,
  ) {}

  async execute(command: RegisterCommand): Promise<RegisterResultDto> {
    const email = EmailValueObject.create(command.email);
    const username = UsernameValueObject.create(command.username);
    const password = PasswordValueObject.create(command.password);
    const displayName = DisplayNameValueObject.create(command.displayName);

    const passwordHash = await this.passwordHasher.hash(password.value);

    const rawVerificationToken = this.secureToken.generate();
    const verificationTokenHash = this.secureToken.hash(rawVerificationToken);

    const verificationExpiresAt = EmailVerificationPolicy.createExpiresAt();

    const result = await this.registrationUnitOfWork.execute({
      email: email.value,
      username: username.value,
      passwordHash,
      displayName: displayName.value,
      rawVerificationToken,
      verificationTokenHash,
      verificationExpiresAt,
      verificationExpiresInMinutes: EmailVerificationPolicy.TTL_MINUTES,
    });

    return RegisterResultMapper.toDto(result);
  }
}
