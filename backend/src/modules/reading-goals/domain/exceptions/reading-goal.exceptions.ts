import { InvalidInputException } from '@/common/exceptions';

export class InvalidReadingGoalTargetException extends InvalidInputException {
  constructor() {
    super({
      code: 'READING_GOAL_INVALID_TARGET',
      message: 'Mục tiêu đọc phải là số nguyên từ 1 đến 100 chương mỗi tuần',
      details: { field: 'targetChapters' },
    });
  }
}
