export class SendAiMessageCommand {
  constructor(
    readonly userId: string,
    readonly conversationId: string,
    readonly content: string,
  ) {}
}
