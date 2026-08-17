import type { OAuthHandoffResultDto } from '../dto';

export const OAUTH_HANDOFF_PORT = Symbol('OAUTH_HANDOFF_PORT');

export interface OAuthHandoffPort {
  issue(result: OAuthHandoffResultDto): Promise<string>;
  consume(handoff: string): Promise<OAuthHandoffResultDto>;
}
