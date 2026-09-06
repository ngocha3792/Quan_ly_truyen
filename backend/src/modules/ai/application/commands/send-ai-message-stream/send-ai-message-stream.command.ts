export class SendAiMessageStreamCommand {
  constructor(
    readonly userId: string,
    readonly conversationId: string,
    readonly content: string,
  ) {}
}
