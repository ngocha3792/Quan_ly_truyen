import type { NotificationSettingsDto } from '../dto';
import type { NotificationPreferenceRecord } from '../ports';

export class NotificationSettingsMapper {
  static toDto(
    preference: NotificationPreferenceRecord | null,
  ): NotificationSettingsDto {
    const preferences = NotificationSettingsMapper.asRecord(
      preference?.preferences,
    );

    return {
      newChapters: preference?.newChapterEnabled ?? true,
      comments: preference?.commentReplyEnabled ?? true,
      system: preference?.moderationEnabled ?? true,
      promotions:
        typeof preferences['promotionsEnabled'] === 'boolean'
          ? preferences['promotionsEnabled']
          : true,
    };
  }

  private static asRecord(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }
}
