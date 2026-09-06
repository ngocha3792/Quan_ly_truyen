export class CreateAiConversationCommand {
  constructor(
    readonly userId: string,
    readonly connectionId: string,
    readonly modelId: string | null,
    readonly title: string,
  ) {}
}
