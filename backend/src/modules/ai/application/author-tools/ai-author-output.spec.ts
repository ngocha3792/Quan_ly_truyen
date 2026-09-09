import {
  assertSourceUnchanged,
  buildAuthorPrompt,
  parseAuthorOutput,
  snapshotAuthorSource,
} from './ai-author-output';
import type { AuthorSource } from './ai-author.types';

const source: AuthorSource = {
  storyVersion: 2,
  chapters: [
    {
      id: 'chapter-1',
      version: 3,
      number: '1',
      title: 'Khởi đầu',
      content: 'An bước vào rừng.',
    },
    {
      id: 'chapter-2',
      version: 4,
      number: '2',
      title: 'Gặp bạn',
      content: 'An gặp Bình.',
    },
  ],
};
describe('AI author output contracts', () => {
  it('preserves summary and accepts a fenced JSON response', () => {
    expect(
      parseAuthorOutput(
        'STORY_SUMMARY',
        '```json\n{"summary":"An vào rừng và gặp Bình."}\n```',
        snapshotAuthorSource(source),
        null,
      ),
    ).toEqual({ summary: 'An vào rừng và gặp Bình.' });
  });
  it.each([
    'ordinary text',
    '{"summary":4}',
    '{"characters":"invented"}',
    '{"summary":""}',
  ])('rejects untyped provider output %s', (content) => {
    expect(() =>
      parseAuthorOutput(
        'STORY_SUMMARY',
        content,
        snapshotAuthorSource(source),
        null,
      ),
    ).toThrow('INVALID_OUTPUT');
  });
  it('validates chapter references in character timelines', () => {
    const character = {
      name: 'An',
      aliases: [],
      description: 'Nhân vật chính',
      firstAppearance: 'chapter-1',
      appearances: [{ chapterId: 'chapter-1', role: 'main', mentions: 1 }],
      relationships: [],
    };
    expect(
      parseAuthorOutput(
        'CHARACTER_EXTRACTION',
        JSON.stringify({ characters: [character] }),
        snapshotAuthorSource(source),
        null,
      ),
    ).toEqual({ characters: [character] });
    expect(() =>
      parseAuthorOutput(
        'CHARACTER_EXTRACTION',
        JSON.stringify({
          characters: [{ ...character, firstAppearance: 'foreign-chapter' }],
        }),
        snapshotAuthorSource(source),
        null,
      ),
    ).toThrow('INVALID_OUTPUT');
  });
  it('rejects issues on another target chapter or with invalid severity', () => {
    const issue = {
      chapterId: 'chapter-2',
      issueType: 'PLOT_HOLE',
      severity: 'HIGH',
      description: 'Mâu thuẫn',
      suggestion: 'Kiểm tra lại',
      relatedChapterIds: ['chapter-1'],
    };
    expect(
      parseAuthorOutput(
        'CONSISTENCY_CHECK',
        JSON.stringify({ issues: [issue] }),
        snapshotAuthorSource(source),
        'chapter-2',
      ),
    ).toEqual({ issues: [issue] });
    expect(() =>
      parseAuthorOutput(
        'CONSISTENCY_CHECK',
        JSON.stringify({ issues: [issue] }),
        snapshotAuthorSource(source),
        'chapter-1',
      ),
    ).toThrow('INVALID_OUTPUT');
    expect(() =>
      parseAuthorOutput(
        'CONSISTENCY_CHECK',
        JSON.stringify({ issues: [{ ...issue, severity: 'CRITICAL' }] }),
        snapshotAuthorSource(source),
        'chapter-2',
      ),
    ).toThrow('INVALID_OUTPUT');
  });
  it('compares JSONB snapshots independent of object key order', () => {
    const snapshot = snapshotAuthorSource(source);
    snapshot.chapters = snapshot.chapters.map((c) => ({
      hash: c.hash,
      number: c.number,
      version: c.version,
      id: c.id,
    }));
    expect(() => assertSourceUnchanged(snapshot, source)).not.toThrow();
  });
  it('rejects content edits even if the caller failed to increment chapter version', () => {
    const changed = {
      ...source,
      chapters: source.chapters.map((c) => ({
        ...c,
        content: c.content + 'New content',
      })),
    };
    expect(() =>
      assertSourceUnchanged(snapshotAuthorSource(source), changed),
    ).toThrow('SOURCE_CHANGED');
    expect(() =>
      assertSourceUnchanged(snapshotAuthorSource(source), {
        ...source,
        chapters: source.chapters.slice(0, 1),
      }),
    ).toThrow('SOURCE_CHANGED');
  });
  it('fails oversized context explicitly instead of returning partial story analysis', () => {
    expect(() =>
      buildAuthorPrompt(
        'STORY_SUMMARY',
        {
          storyVersion: 1,
          chapters: [{ ...source.chapters[0], content: 'x'.repeat(40_000) }],
        },
        null,
      ),
    ).toThrow('SOURCE_TOO_LARGE');
  });
  it('rejects a changed character bible and validates target block anchors', () => {
    const known = {
      id: 'character',
      name: 'An',
      description: 'Known',
      aliases: [],
      isVerified: true,
      updatedAt: '2026-09-09T00:00:00Z',
    };
    const withKnowledge = {
      ...source,
      characters: [known],
      chapters: source.chapters.map((c) => ({
        ...c,
        blocks: [{ id: `block-${c.id}`, text: c.content }],
      })),
    };
    const snapshot = snapshotAuthorSource(withKnowledge);
    expect(() =>
      assertSourceUnchanged(snapshot, {
        ...withKnowledge,
        characters: [{ ...known, description: 'Changed' }],
      }),
    ).toThrow('SOURCE_CHANGED');
    const issue = {
      chapterId: 'chapter-2',
      blockId: 'block-chapter-1',
      issueType: 'PLOT_HOLE',
      severity: 'LOW',
      description: 'Mismatch',
      suggestion: 'Review',
      relatedChapterIds: [],
    };
    expect(() =>
      parseAuthorOutput(
        'CONSISTENCY_CHECK',
        JSON.stringify({ issues: [issue] }),
        snapshot,
        'chapter-2',
      ),
    ).toThrow('INVALID_OUTPUT');
    expect(
      parseAuthorOutput(
        'CONSISTENCY_CHECK',
        JSON.stringify({ issues: [{ ...issue, blockId: 'block-chapter-2' }] }),
        snapshot,
        'chapter-2',
      ),
    ).toMatchObject({ issues: [{ blockId: 'block-chapter-2' }] });
  });
});
