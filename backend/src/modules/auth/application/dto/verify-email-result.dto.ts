export interface VerifyEmailResultDto {
  emailVerified: true;
  alreadyVerified: boolean;
  verifiedAt: Date;
}
