import type { AiProfilePersistencePort } from '../ports/ai-profile.persistence.port';
import { AiProfileManager } from './ai-profile.manager';

describe('AiProfileManager', () => {
  const updatedAt = new Date('2026-09-06T00:00:00Z');
  let persistence: jest.Mocked<AiProfilePersistencePort>;
  let findStory: jest.Mock;
  let manager: AiProfileManager;

  beforeEach(() => {
    findStory = jest.fn().mockResolvedValue(null);
    persistence = {
      userExists: jest.fn().mockResolvedValue(true),
      storyExistsForOwner: jest.fn().mockResolvedValue(true),
      findUser: jest.fn().mockResolvedValue({
        userId: 'user-1',
        model: 'user-model',
        systemPrompt: 'user-style',
        defaultTranslationLanguageCode: 'ja',
        autoTranslateOnPublish: true,
        updatedAt,
      }),
      findStory,
      upsertUser: jest.fn(),
      upsertStory: jest.fn(),
    };
    manager = new AiProfileManager(persistence);
  });

  it('story không cấu hình sẽ kế thừa toàn bộ user profile', async () => {
    await expect(manager.getStory('user-1', 'story-1')).resolves.toMatchObject({
      scope: 'STORY',
      model: 'user-model',
      systemPrompt: 'user-style',
      defaultTranslationLanguageCode: 'ja',
      autoTranslateOnPublish: true,
      inherits: [
        'model',
        'systemPrompt',
        'defaultTranslationLanguageCode',
        'autoTranslateOnPublish',
      ],
    });
  });

  it('story override từng field và vẫn kế thừa các field null', async () => {
    findStory.mockResolvedValue({
      storyId: 'story-1',
      userId: 'user-1',
      model: 'story-model',
      systemPrompt: null,
      defaultTranslationLanguageCode: 'ko',
      autoTranslateOnPublish: false,
      updatedAt,
    });

    await expect(manager.getStory('user-1', 'story-1')).resolves.toMatchObject({
      model: 'story-model',
      systemPrompt: 'user-style',
      defaultTranslationLanguageCode: 'ko',
      autoTranslateOnPublish: false,
      inherits: ['systemPrompt'],
    });
  });

  it('không cho đọc profile của story không thuộc user', async () => {
    persistence.storyExistsForOwner.mockResolvedValue(false);

    await expect(
      manager.getStory('user-1', 'story-other'),
    ).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
    });
    expect(findStory).not.toHaveBeenCalled();
  });
});
