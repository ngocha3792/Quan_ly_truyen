export interface SecurityQuestionAnswerCommandInput {
  questionId: string;

  answer: string;
}

export class UpdateSecurityQuestionsCommand {
  constructor(
    readonly userId: string | undefined,

    readonly currentSessionId: string | undefined,

    readonly currentPassword: string,

    readonly answers: readonly SecurityQuestionAnswerCommandInput[],
  ) {}
}

export class RemoveSecurityQuestionsCommand {
  constructor(
    readonly userId: string | undefined,

    readonly currentSessionId: string | undefined,

    readonly currentPassword: string,
  ) {}
}
