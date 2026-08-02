export const REGISTRATION_UNIT_OF_WORK_PORT = Symbol(
  'AUTH_REGISTRATION_UNIT_OF_WORK_PORT',
);

export interface RegistrationUnitOfWorkInput {
  email: string;
  username: string;
  passwordHash: string;
  displayName: string;

  rawVerificationToken: string;
  verificationTokenHash: string;
  verificationExpiresAt: Date;
  verificationExpiresInMinutes: number;
}

export interface RegistrationUnitOfWorkResult {
  id: string;
  email: string;
  username: string;
  displayName: string;
}

export interface RegistrationUnitOfWorkPort {
  execute(
    input: RegistrationUnitOfWorkInput,
  ): Promise<RegistrationUnitOfWorkResult>;
}
