export interface SecurityQuestionOptionResultDto {
  id: string;

  label: string;
}

export interface ConfiguredSecurityQuestionResultDto {
  id: string;

  questionId: string;

  label: string;

  updatedAt: Date;
}

export interface SecurityQuestionsStateResultDto {
  configured: boolean;

  questions: readonly ConfiguredSecurityQuestionResultDto[];

  updatedAt: Date | null;
}
