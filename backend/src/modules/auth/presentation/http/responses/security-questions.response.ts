export interface SecurityQuestionOptionResponse {
  id: string;

  label: string;
}

export interface ConfiguredSecurityQuestionResponse {
  id: string;

  questionId: string;

  label: string;

  updatedAt: string;
}

export interface SecurityQuestionsStateResponse {
  configured: boolean;

  questions: readonly ConfiguredSecurityQuestionResponse[];

  updatedAt: string | null;
}
