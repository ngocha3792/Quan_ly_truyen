import type { AuthPrincipal } from '@/common/interfaces/auth';

export type GuardPrincipal = AuthPrincipal & {
  sub?: string;
  sid?: string;
  emailVerifiedAt?: Date | string | null;
};

export interface GuardHttpRequest {
  user?: GuardPrincipal;
  headers?: Readonly<Record<string, string | readonly string[] | undefined>>;
}
