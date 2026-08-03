export interface RequestEmailChangeResultDto {
  emailChangeRequested: true;

  pendingEmail: string;

  verificationRequired: true;

  expiresAt: Date;
}
