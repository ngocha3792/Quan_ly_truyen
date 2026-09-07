import type { PublicChapterReaderDto } from '../../../application';
import { toPublicChapterReaderResponse } from './public-chapter-reader.response';

describe('toPublicChapterReaderResponse', () => {
  it('never includes full content in the locked response variant', () => {
    const result: PublicChapterReaderDto = {
      story: { id: 'story-1', slug: 'story', title: 'Story' },
      chapter: {
        id: 'chapter-1',
        number: 1,
        title: 'Chapter',
        slug: 'chapter-1',
        access: { state: 'LOCKED', priceCredits: '25' },
        previewContent: 'Preview only',
        previewFormat: 'MARKDOWN',
        wordCount: 1_000,
        views: 10,
        comments: 2,
        publishedAt: new Date('2026-09-07T00:00:00.000Z'),
        updatedAt: new Date('2026-09-07T01:00:00.000Z'),
      },
      navigation: { previous: null, next: null },
    };

    const response = toPublicChapterReaderResponse(result);

    expect(response.chapter).toMatchObject({
      access: { state: 'LOCKED', priceCredits: '25' },
      previewContent: 'Preview only',
    });
    expect(response.chapter).not.toHaveProperty('content');
    expect(response.chapter).not.toHaveProperty('contentFormat');
  });

  it('drops an accidentally attached full-content field from a locked DTO', () => {
    const compromised = {
      story: { id: 'story-1', slug: 'story', title: 'Story' },
      chapter: {
        id: 'chapter-1',
        number: 1,
        title: 'Chapter',
        slug: 'chapter-1',
        access: { state: 'LOCKED', priceCredits: '25' },
        previewContent: 'Preview only',
        previewFormat: 'MARKDOWN',
        content: 'FULL_CONTENT_SENTINEL_MUST_NOT_LEAK',
        contentFormat: 'MARKDOWN',
        wordCount: 1_000,
        views: 10,
        comments: 2,
        publishedAt: new Date('2026-09-07T00:00:00.000Z'),
        updatedAt: new Date('2026-09-07T01:00:00.000Z'),
      },
      navigation: { previous: null, next: null },
    } as unknown as PublicChapterReaderDto;

    const serialized = JSON.stringify(
      toPublicChapterReaderResponse(compromised),
    );
    expect(serialized).not.toContain('FULL_CONTENT_SENTINEL_MUST_NOT_LEAK');
    expect(serialized).not.toContain('contentFormat');
  });
});
