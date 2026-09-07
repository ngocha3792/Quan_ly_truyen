import { NotificationSettingsMapper } from './notification-settings.mapper';

describe('NotificationSettingsMapper', () => {
  it('keeps weekly recap channels opt-in by default', () => {
    expect(NotificationSettingsMapper.toDto(null)).toEqual({
      newChapters: true,
      comments: true,
      system: true,
      promotions: true,
      weeklyRecapInApp: false,
      weeklyRecapEmail: false,
    });
  });

  it('maps explicit weekly recap choices from the extensible preference JSON', () => {
    expect(
      NotificationSettingsMapper.toDto({
        newChapterEnabled: true,
        commentReplyEnabled: false,
        moderationEnabled: true,
        preferences: {
          promotionsEnabled: false,
          weeklyRecapInApp: true,
          weeklyRecapEmail: true,
        },
      }),
    ).toEqual({
      newChapters: true,
      comments: false,
      system: true,
      promotions: false,
      weeklyRecapInApp: true,
      weeklyRecapEmail: true,
    });
  });
});
