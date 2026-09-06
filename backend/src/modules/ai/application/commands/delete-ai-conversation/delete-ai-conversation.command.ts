export class DeleteAiConversationCommand {
  constructor(
    readonly userId: string,
    readonly conversationId: string,
  ) {}
}
