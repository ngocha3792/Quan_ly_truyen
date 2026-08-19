import type { AuthPrincipal } from '@/common/interfaces/auth';
import type { ConfirmMediaUploadInput } from '../../dto';
export class ConfirmMediaUploadCommand {
  constructor(
    readonly principal: AuthPrincipal,
    readonly mediaAssetId: string,
    readonly dto: ConfirmMediaUploadInput,
  ) {}
}
