import type { LoginClientContext } from '../commands/login/login.command';
import type { LoginResultDto, OAuthAuthorizationResultDto } from '../dto';

export const OAUTH_FLOW_PORT = Symbol('OAUTH_FLOW_PORT');

export interface OAuthFlowPort {
  createAuthorizationUrl(
    provider: string,
    client: LoginClientContext,
  ): Promise<OAuthAuthorizationResultDto>;

  complete(
    provider: string,
    code: string | undefined,
    state: string | undefined,
    browserState: string,
    providerError: string | undefined,
    clientOverride: LoginClientContext,
  ): Promise<LoginResultDto>;
}
