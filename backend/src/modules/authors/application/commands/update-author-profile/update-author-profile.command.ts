import type { UpdateAuthorProfileInput } from '../../dto';
export class UpdateAuthorProfileCommand {
  constructor(readonly input: UpdateAuthorProfileInput) {}
}
