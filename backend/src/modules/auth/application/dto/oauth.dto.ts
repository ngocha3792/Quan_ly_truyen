export interface OAuthAuthorizationResultDto {
  url: string;
  state: string;
  expiresAt: Date;
}

export interface OAuthHandoffMfaChallengeDto {
  mfaTicket: string;
  mode: 'enroll' | 'verify';
  expiresAt: string;
}

export type OAuthHandoffResultDto =
  | { status: 'success' }
  | {
      status: 'mfa';
      challenge: OAuthHandoffMfaChallengeDto;
    }
  | {
      status: 'error';
      code: string;
      message: string;
    };
