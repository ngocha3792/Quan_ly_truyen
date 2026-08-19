import type { AuthPrincipal } from '@/common/interfaces/auth';
export class DeleteMediaCommand {
  constructor(
    readonly mediaId: string,
    readonly principal?: AuthPrincipal,
  ) {}
}
