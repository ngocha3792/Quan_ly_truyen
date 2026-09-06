export class GetAiConversationQuery {
  constructor(
    readonly userId: string,
    readonly conversationId: string,
  ) {}
}
