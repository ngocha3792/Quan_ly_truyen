import type { CreateMediaUploadIntentInput } from '../../dto';
export class CreateMediaUploadIntentCommand {
  constructor(readonly input: CreateMediaUploadIntentInput) {}
}
