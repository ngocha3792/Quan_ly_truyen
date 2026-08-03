export interface RequestEmailChangeResponse {
  emailChangeRequested: true;

  pendingEmail: string;

  verificationRequired: true;

  expiresAt: string;
}
