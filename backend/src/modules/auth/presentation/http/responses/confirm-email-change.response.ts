export interface ConfirmEmailChangeResponse {
  emailChanged: true;

  alreadyChanged: boolean;

  previousEmail: string;

  email: string;

  sessionsRevoked: number;

  reauthenticationRequired: true;

  changedAt: string;
}
