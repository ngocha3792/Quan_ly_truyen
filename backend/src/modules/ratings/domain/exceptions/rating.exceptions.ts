import {
  InvalidInputException,
  ResourceNotFoundException,
} from '@/common/exceptions';

export class InvalidRatingScoreException extends InvalidInputException {
  constructor() {
    super({
      code: 'RATING_INVALID_SCORE',
      message: 'Điểm đánh giá phải là số nguyên từ 1 đến 5',
      details: { field: 'score' },
    });
  }
}

export class RatedStoryNotFoundException extends ResourceNotFoundException {
  constructor(storyId?: string) {
    super({
      code: 'STORY_NOT_FOUND',
      resource: 'truyện',
      ...(storyId ? { identifier: storyId } : {}),
      message: 'Không tìm thấy truyện',
    });
  }
}
