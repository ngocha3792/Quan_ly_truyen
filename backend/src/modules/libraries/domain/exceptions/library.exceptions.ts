import { ResourceNotFoundException } from '@/common/exceptions';

export class LibraryStoryNotFoundException extends ResourceNotFoundException {
  constructor(storyId?: string) {
    super({
      code: 'STORY_NOT_FOUND',
      resource: 'truyện',
      ...(storyId ? { identifier: storyId } : {}),
      message: 'Không tìm thấy truyện',
    });
  }
}
