import {
  InvalidInputException,
  ResourceConflictException,
  ResourceNotFoundException,
} from '@/common/exceptions';

export class TagNotFoundException extends ResourceNotFoundException {
  constructor(id: string) {
    super({ code: 'TAG_NOT_FOUND', resource: 'tag', identifier: id });
  }
}

export class TagNameAlreadyExistsException extends ResourceConflictException {
  constructor(name: string) {
    super({
      code: 'TAG_NAME_ALREADY_EXISTS',
      message: 'Tên tag đã tồn tại',
      field: 'name',
      value: name,
    });
  }
}

export class TagInUseException extends ResourceConflictException {
  constructor(storyCount: number) {
    super({
      code: 'TAG_IN_USE',
      message: 'Tag đang được truyện sử dụng',
      details: { storyCount },
    });
  }
}

export class TagMergeTargetNotFoundException extends ResourceNotFoundException {
  constructor(id: string) {
    super({
      code: 'TAG_MERGE_TARGET_NOT_FOUND',
      resource: 'tag đích',
      identifier: id,
    });
  }
}

export class TagCannotMergeIntoSelfException extends InvalidInputException {
  constructor() {
    super({
      code: 'TAG_CANNOT_MERGE_INTO_SELF',
      message: 'Không thể hợp nhất tag vào chính nó',
    });
  }
}

export class TagSlugGenerationException extends ResourceConflictException {
  constructor() {
    super({
      code: 'TAXONOMY_SLUG_GENERATION_FAILED',
      message: 'Không thể tạo slug duy nhất cho tag',
    });
  }
}
