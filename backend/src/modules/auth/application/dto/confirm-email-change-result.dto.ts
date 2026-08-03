export interface ConfirmEmailChangeResultDto {
  emailChanged: true;

  alreadyChanged: boolean;

  previousEmail: string;

  email: string;

  sessionsRevoked: number;

  reauthenticationRequired: true;

  changedAt: Date;
}
