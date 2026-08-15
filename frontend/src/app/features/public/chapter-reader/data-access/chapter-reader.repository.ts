import { Observable } from 'rxjs';

import { ChapterReaderView } from '../domain/chapter-reader.models';

export abstract class ChapterReaderRepository {
  abstract getChapter(storySlug: string, chapterNumber: string): Observable<ChapterReaderView>;
}
