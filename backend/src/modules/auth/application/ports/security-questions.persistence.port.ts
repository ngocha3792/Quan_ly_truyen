export const SECURITY_QUESTIONS_PERSISTENCE_PORT = Symbol(
  'AUTH_SECURITY_QUESTIONS_PERSISTENCE_PORT',
);

export interface SecurityQuestionsCredentialRecord {
  passwordHash: string | null;
}

export interface SecurityQuestionCatalogRecord {
  id: string;

  label: string;
}

export interface ConfiguredSecurityQuestionRecord {
  id: string;

  questionId: string;

  label: string;

  updatedAt: Date;
}

export interface SecurityQuestionsStateRecord {
  questions: readonly ConfiguredSecurityQuestionRecord[];
}

export interface SecurityQuestionAnswerWrite {
  questionId: string;

  answerHash: string;

  position: number;
}

export interface UpdateSecurityQuestionsInput {
  userId: string;

  currentSessionId: string;

  expectedPasswordHash: string;

  locale: string;

  answers: readonly SecurityQuestionAnswerWrite[];

  updatedAt: Date;
}

export type UpdateSecurityQuestionsPersistenceResult =
  | {
      status: 'updated';

      value: SecurityQuestionsStateRecord;
    }
  | {
      status: 'invalid_questions';
    }
  | {
      status: 'current_session_unavailable';
    }
  | {
      status: 'conflict';
    };

export interface RemoveSecurityQuestionsInput {
  userId: string;

  currentSessionId: string;

  expectedPasswordHash: string;

  removedAt: Date;
}

export type RemoveSecurityQuestionsPersistenceResult =
  | {
      status: 'removed';

      value: SecurityQuestionsStateRecord;
    }
  | {
      status: 'current_session_unavailable';
    }
  | {
      status: 'conflict';
    };

export interface SecurityQuestionsPersistencePort {
  findCredentialByUserId(
    userId: string,
  ): Promise<SecurityQuestionsCredentialRecord | null>;

  findCatalog(
    locale: string,
  ): Promise<readonly SecurityQuestionCatalogRecord[]>;

  findStateByUserId(
    userId: string,
  ): Promise<SecurityQuestionsStateRecord | null>;

  update(
    input: UpdateSecurityQuestionsInput,
  ): Promise<UpdateSecurityQuestionsPersistenceResult>;

  remove(
    input: RemoveSecurityQuestionsInput,
  ): Promise<RemoveSecurityQuestionsPersistenceResult>;
}
