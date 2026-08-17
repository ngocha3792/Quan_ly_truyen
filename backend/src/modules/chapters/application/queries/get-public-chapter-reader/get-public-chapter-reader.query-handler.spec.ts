import {
  ChapterNotFoundException,
  InvalidChapterFieldException,
} from '../../../domain';

import { GetPublicChapterReaderQuery } from './get-public-chapter-reader.query';
import { GetPublicChapterReaderQueryHandler } from './get-public-chapter-reader.query-handler';

describe('GetPublicChapterReaderQueryHandler', () => {
  let persistence: { findPublicReader: jest.Mock };
  let handler: GetPublicChapterReaderQueryHandler;

  beforeEach(() => {
    persistence = { findPublicReader: jest.fn() };
    handler = new GetPublicChapterReaderQueryHandler(persistence as never);
  });

  it('normalize story slug và hỗ trợ chapter number thập phân', async () => {
    const reader = { chapter: { id: 'chapter-id' } };
    persistence.findPublicReader.mockResolvedValue(reader);

    const result = await handler.execute(
      new GetPublicChapterReaderQuery('  Truyen-Moi  ', ' 1.50 '),
    );

    expect(persistence.findPublicReader).toHaveBeenCalledWith(
      'truyen-moi',
      '1.50',
    );
    expect(result).toBe(reader);
  });

  it('reject chapter number sai định dạng trước khi query database', async () => {
    await expect(
      handler.execute(new GetPublicChapterReaderQuery('truyen-moi', '1.234')),
    ).rejects.toBeInstanceOf(InvalidChapterFieldException);

    expect(persistence.findPublicReader).not.toHaveBeenCalled();
  });

  it('trả CHAPTER_NOT_FOUND khi chapter không public hoặc không tồn tại', async () => {
    persistence.findPublicReader.mockResolvedValue(null);

    await expect(
      handler.execute(new GetPublicChapterReaderQuery('truyen-moi', '12')),
    ).rejects.toBeInstanceOf(ChapterNotFoundException);
  });
});
