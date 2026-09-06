export class CreateAiConversationCommand {
  constructor(
    readonly userId: string,
    readonly connectionId: string,
    readonly title: string,
  ) {}
}
