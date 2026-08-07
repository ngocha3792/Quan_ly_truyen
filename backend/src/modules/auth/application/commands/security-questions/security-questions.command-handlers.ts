import { Inject, Injectable } from '@nestjs/common';

import {
  AuthenticationRequiredException,
  InvalidInputException,
} from '@/common/exceptions';

import { isUuidV4, sha256 } from '@/common/utils';

import type { SecurityQuestionsStateResultDto } from '../../dto';

import { SecurityQuestionsMapper } from '../../mappers';

import {
  PASSWORD_HASHER_PORT,
  type PasswordHasherPort,
  SECURITY_QUESTIONS_PERSISTENCE_PORT,
  type SecurityQuestionsPersistencePort,
} from '../../ports';

import {
  InvalidCurrentPasswordException,
  SecurityQuestionsUnavailableException,
} from '../../../domain/exceptions';

import {
  CurrentPasswordValueObject,
  SecurityQuestionAnswerValueObject,
} from '../../../domain/value-objects';

import {
  RemoveSecurityQuestionsCommand,
  UpdateSecurityQuestionsCommand,
} from './security-questions.commands';

const REQUIRED_QUESTION_COUNT = 3;

const SECURITY_QUESTION_LOCALE = 'vi';

@Injectable()
export class UpdateSecurityQuestionsCommandHandler {
  constructor(
    @Inject(SECURITY_QUESTIONS_PERSISTENCE_PORT)
    private readonly persistence: SecurityQuestionsPersistencePort,

    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(
    command: UpdateSecurityQuestionsCommand,
  ): Promise<SecurityQuestionsStateResultDto> {
    const { userId, sessionId } = requireAuthenticatedSession(
      command.userId,

      command.currentSessionId,
    );

    if (command.answers.length !== REQUIRED_QUESTION_COUNT) {
      throw new InvalidInputException({
        code: 'AUTH_SECURITY_QUESTIONS_COUNT_INVALID',

        message: 'Bạn phải thiết lập đúng 3 câu hỏi bảo mật',

        details: {
          field: 'answers',

          required: REQUIRED_QUESTION_COUNT,
        },
      });
    }

    /*
     * Không cho duplicate question.
     */
    const questionIds = command.answers.map((answer) => answer.questionId);

    if (
      questionIds.some((questionId) => !isUuidV4(questionId)) ||
      new Set(questionIds).size !== REQUIRED_QUESTION_COUNT
    ) {
      throw invalidQuestions();
    }

    /*
     * Normalize answer.
     */
    const normalizedAnswers = command.answers.map((answer) => ({
      questionId: answer.questionId,

      answer: SecurityQuestionAnswerValueObject.create(answer.answer),
    }));

    /*
     * Không cho cùng một câu trả lời
     * ở nhiều câu hỏi.
     */
    const comparisonValues = normalizedAnswers.map(
      (item) => item.answer.comparisonValue,
    );

    if (new Set(comparisonValues).size !== REQUIRED_QUESTION_COUNT) {
      throw new InvalidInputException({
        code: 'AUTH_SECURITY_QUESTION_ANSWERS_DUPLICATED',

        message: 'Không sử dụng cùng một câu trả lời cho nhiều câu hỏi',

        details: {
          field: 'answers',
        },
      });
    }

    const currentPassword = CurrentPasswordValueObject.create(
      command.currentPassword,
    );

    const credential = await this.persistence.findCredentialByUserId(userId);

    if (!credential) {
      throw accountUnavailable();
    }

    if (!credential.passwordHash) {
      throw new SecurityQuestionsUnavailableException();
    }

    const passwordMatches = await this.passwordHasher.verify(
      currentPassword.value,

      credential.passwordHash,
    );

    if (!passwordMatches) {
      throw new InvalidCurrentPasswordException();
    }

    /*
     * Không bcrypt raw answer trực tiếp:
     *
     * bcrypt chỉ xử lý tối đa 72 bytes,
     * trong khi UI cho answer tới 128 ký tự.
     *
     * SHA-256 trước -> fixed 64 ASCII chars,
     * sau đó bcrypt -> vẫn có salt + cost.
     *
     * Domain prefix tránh dùng cùng digest
     * trong mục đích khác.
     */
    const hashedAnswers = await Promise.all(
      normalizedAnswers.map(async (item, index) => ({
        questionId: item.questionId,

        answerHash: await this.passwordHasher.hash(
          securityAnswerHashInput(item.answer.value),
        ),

        position: index + 1,
      })),
    );

    const result = await this.persistence.update({
      userId,

      currentSessionId: sessionId,

      expectedPasswordHash: credential.passwordHash,

      locale: SECURITY_QUESTION_LOCALE,

      answers: hashedAnswers,

      updatedAt: new Date(),
    });

    switch (result.status) {
      case 'updated':
        return SecurityQuestionsMapper.stateToDto(result.value);

      case 'invalid_questions':
        throw invalidQuestions();

      case 'current_session_unavailable':
        throw currentSessionUnavailable();

      case 'conflict':
      default:
        /*
         * Password/account thay đổi giữa
         * bước verify và transaction.
         */
        throw new InvalidCurrentPasswordException();
    }
  }
}

@Injectable()
export class RemoveSecurityQuestionsCommandHandler {
  constructor(
    @Inject(SECURITY_QUESTIONS_PERSISTENCE_PORT)
    private readonly persistence: SecurityQuestionsPersistencePort,

    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(
    command: RemoveSecurityQuestionsCommand,
  ): Promise<SecurityQuestionsStateResultDto> {
    const { userId, sessionId } = requireAuthenticatedSession(
      command.userId,

      command.currentSessionId,
    );

    const currentPassword = CurrentPasswordValueObject.create(
      command.currentPassword,
    );

    const credential = await this.persistence.findCredentialByUserId(userId);

    if (!credential) {
      throw accountUnavailable();
    }

    if (!credential.passwordHash) {
      throw new SecurityQuestionsUnavailableException();
    }

    const passwordMatches = await this.passwordHasher.verify(
      currentPassword.value,

      credential.passwordHash,
    );

    if (!passwordMatches) {
      throw new InvalidCurrentPasswordException();
    }

    const result = await this.persistence.remove({
      userId,

      currentSessionId: sessionId,

      expectedPasswordHash: credential.passwordHash,

      removedAt: new Date(),
    });

    switch (result.status) {
      case 'removed':
        return SecurityQuestionsMapper.stateToDto(result.value);

      case 'current_session_unavailable':
        throw currentSessionUnavailable();

      case 'conflict':
      default:
        throw new InvalidCurrentPasswordException();
    }
  }
}

function requireAuthenticatedSession(
  userId: string | undefined,

  sessionId: string | undefined,
): {
  userId: string;

  sessionId: string;
} {
  if (!userId || !sessionId || !isUuidV4(userId) || !isUuidV4(sessionId)) {
    throw currentSessionUnavailable();
  }

  return {
    userId,

    sessionId,
  };
}

function securityAnswerHashInput(normalizedAnswer: string): string {
  return sha256(`auth-security-question-answer:v1:${normalizedAnswer}`);
}

function invalidQuestions(): InvalidInputException {
  return new InvalidInputException({
    code: 'AUTH_SECURITY_QUESTION_INVALID',

    message:
      'Một hoặc nhiều câu hỏi bảo mật không hợp lệ hoặc không còn được sử dụng',

    details: {
      field: 'answers',
    },
  });
}

function accountUnavailable(): AuthenticationRequiredException {
  return new AuthenticationRequiredException({
    code: 'AUTH_ACCOUNT_NOT_AVAILABLE',

    message: 'Tài khoản hiện tại không còn khả dụng',
  });
}

function currentSessionUnavailable(): AuthenticationRequiredException {
  return new AuthenticationRequiredException({
    code: 'AUTH_CURRENT_SESSION_UNAVAILABLE',

    message: 'Phiên đăng nhập hiện tại không còn hiệu lực',
  });
}
