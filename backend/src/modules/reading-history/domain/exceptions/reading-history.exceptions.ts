import { ResourceNotFoundException } from '@/common/exceptions';

export class ReadingHistoryStoryNotFoundException extends ResourceNotFoundException {
  constructor(storyId?: string) {
    super({
      code: 'STORY_NOT_FOUND',
      resource: 'truyện',
      ...(storyId ? { identifier: storyId } : {}),
      message: 'Không tìm thấy truyện',
    });
  }
}

export class ReadingHistoryChapterNotFoundException extends ResourceNotFoundException {
  constructor(chapterId?: string) {
    super({
      code: 'CHAPTER_NOT_FOUND',
      resource: 'chương',
      ...(chapterId ? { identifier: chapterId } : {}),
      message: 'Không tìm thấy chương',
    });
  }
}
