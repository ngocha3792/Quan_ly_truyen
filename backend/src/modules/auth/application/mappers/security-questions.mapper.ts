import type {
  SecurityQuestionOptionResultDto,
  SecurityQuestionsStateResultDto,
} from '../dto';

import type {
  SecurityQuestionCatalogRecord,
  SecurityQuestionsStateRecord,
} from '../ports';

export class SecurityQuestionsMapper {
  static catalogToDto(
    records: readonly SecurityQuestionCatalogRecord[],
  ): readonly SecurityQuestionOptionResultDto[] {
    return records.map((record) => ({
      id: record.id,

      label: record.label,
    }));
  }

  static stateToDto(
    record: SecurityQuestionsStateRecord,
  ): SecurityQuestionsStateResultDto {
    const questions = [...record.questions].sort(
      (left, right) => left.updatedAt.getTime() - right.updatedAt.getTime(),
    );

    let updatedAt: Date | null = null;

    for (const question of questions) {
      if (!updatedAt || question.updatedAt > updatedAt) {
        updatedAt = question.updatedAt;
      }
    }

    return {
      /*
       * Product/UI hiện tại bắt buộc đúng 3.
       */
      configured: questions.length === 3,

      questions: record.questions.map((question) => ({
        id: question.id,

        questionId: question.questionId,

        label: question.label,

        updatedAt: question.updatedAt,
      })),

      updatedAt,
    };
  }
}
