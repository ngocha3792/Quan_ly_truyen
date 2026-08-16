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

export class CategoryNotFoundException extends ResourceNotFoundException {
  constructor(id: string) {
    super({ code: 'CATEGORY_NOT_FOUND', resource: 'thể loại', identifier: id });
  }
}

export class CategoryNameAlreadyExistsException extends ResourceConflictException {
  constructor(name: string) {
    super({
      code: 'CATEGORY_NAME_ALREADY_EXISTS',
      message: 'Tên thể loại đã tồn tại',
      field: 'name',
      value: name,
    });
  }
}

export class CategoryInUseException extends ResourceConflictException {
  constructor(storyCount: number) {
    super({
      code: 'CATEGORY_IN_USE',
      message: 'Thể loại đang được truyện sử dụng',
      details: { storyCount },
    });
  }
}

export class CategoryHasChildrenException extends ResourceConflictException {
  constructor(childCount: number) {
    super({
      code: 'CATEGORY_HAS_CHILDREN',
      message: 'Thể loại còn thể loại con',
      details: { childCount },
    });
  }
}

export class CategoryHasActiveChildrenException extends ResourceConflictException {
  constructor(childCount: number) {
    super({
      code: 'CATEGORY_HAS_ACTIVE_CHILDREN',
      message: 'Hãy ngừng hoạt động hoặc chuyển các thể loại con trước',
      details: { childCount },
    });
  }
}

export class CategoryParentNotFoundException extends ResourceNotFoundException {
  constructor(id: string) {
    super({
      code: 'CATEGORY_PARENT_NOT_FOUND',
      resource: 'thể loại cha',
      identifier: id,
    });
  }
}

export class CategoryParentInactiveException extends ResourceConflictException {
  constructor(id: string) {
    super({
      code: 'CATEGORY_PARENT_INACTIVE',
      message: 'Thể loại đang hoạt động phải có thể loại cha đang hoạt động',
      details: { parentId: id },
    });
  }
}

export class CategoryHierarchyCycleException extends ResourceConflictException {
  constructor() {
    super({
      code: 'CATEGORY_HIERARCHY_CYCLE',
      message: 'Quan hệ thể loại cha tạo thành chu kỳ',
    });
  }
}

export class TaxonomySlugGenerationException extends ResourceConflictException {
  constructor(resource: 'tag' | 'category') {
    super({
      code: 'TAXONOMY_SLUG_GENERATION_FAILED',
      message: `Không thể tạo slug duy nhất cho ${resource}`,
    });
  }
}
