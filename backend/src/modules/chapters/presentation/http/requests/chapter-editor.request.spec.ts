import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ChapterExpectedVersionRequest } from './chapter-expected-version.request';
import { UpdateAuthorChapterRequest } from './update-author-chapter.request';
import { ListAuthorChapterVersionsRequest } from './list-author-chapter-versions.request';

describe('chapter editor version contract', () => {
  it.each([undefined, null, 0, -1, 1.1, '1'])(
    'rejects missing or invalid expectedVersion %s',
    async (expectedVersion) => {
      for (const Type of [
        ChapterExpectedVersionRequest,
        UpdateAuthorChapterRequest,
      ]) {
        const errors = await validate(
          plainToInstance(Type, { expectedVersion }),
        );
        expect(errors.some((e) => e.property === 'expectedVersion')).toBe(true);
      }
    },
  );
  it('accepts numeric versions and rejects mass assigned status', async () => {
    expect(
      await validate(
        plainToInstance(UpdateAuthorChapterRequest, {
          expectedVersion: 2,
          content: 'Nội dung',
        }),
      ),
    ).toEqual([]);
    expect(
      (
        await validate(
          plainToInstance(UpdateAuthorChapterRequest, {
            expectedVersion: 2,
            status: 'PUBLISHED',
          }),
          { whitelist: true, forbidNonWhitelisted: true },
        )
      ).some((e) => e.property === 'status'),
    ).toBe(true);
  });
  it('parses autosave filter explicitly rather than coercing false to true', async () => {
    expect(
      plainToInstance(ListAuthorChapterVersionsRequest, {}).includeAutosaves,
    ).toBe(false);
    expect(
      plainToInstance(ListAuthorChapterVersionsRequest, {
        includeAutosaves: 'false',
      }).includeAutosaves,
    ).toBe(false);
    expect(
      plainToInstance(ListAuthorChapterVersionsRequest, {
        includeAutosaves: 'true',
      }).includeAutosaves,
    ).toBe(true);
    expect(
      (
        await validate(
          plainToInstance(ListAuthorChapterVersionsRequest, {
            includeAutosaves: 'yes',
          }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
});
