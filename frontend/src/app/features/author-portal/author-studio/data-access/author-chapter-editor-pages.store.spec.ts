import { TestBed } from '@angular/core/testing';
import { Observable, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthorChapterMediaPage, AuthorStoryMedia } from '../domain/author-story-management.models';
import { AuthorStoryManagementRepository } from '../domain/author-story-management.repository';
import { AuthorChapterEditorStore } from './author-chapter-editor.store';

function file(name: string): File {
  return new File([name], name, { type: 'image/webp' });
}

function page(mediaAssetId: string, sortOrder: number): AuthorChapterMediaPage {
  return {
    mediaAssetId,
    sortOrder,
    altText: null,
    caption: null,
    url: `https://cdn.test/${mediaAssetId}.webp`,
    width: 800,
    height: 1200,
  };
}

describe('Uploading manga pages keeps the order the author chose', () => {
  let store: AuthorChapterEditorStore;
  /** Ảnh đã bắt đầu tải, theo đúng thứ tự bắt đầu. */
  let uploads: Map<string, Subject<AuthorStoryMedia>>;
  /** Trang đã gắn vào chương, theo đúng thứ tự gắn. */
  let attached: string[];
  let failFirstUpload: boolean;

  beforeEach(() => {
    uploads = new Map();
    attached = [];
    failFirstUpload = false;

    const repository = {
      uploadChapterImage: vi.fn(
        (_chapterId: string, upload: File): Observable<AuthorStoryMedia> => {
          if (failFirstUpload && uploads.size === 0) {
            uploads.set(upload.name, new Subject<AuthorStoryMedia>());
            return throwError(() => new Error('Tải ảnh thất bại'));
          }
          const subject = new Subject<AuthorStoryMedia>();
          uploads.set(upload.name, subject);
          return subject.asObservable();
        },
      ),
      // Máy chủ luôn trả về nguyên danh sách trang hiện có của chương.
      attachChapterMedia: vi.fn(
        (
          _storyId: string,
          _chapterId: string,
          pages: ReadonlyArray<{ readonly mediaAssetId: string }>,
        ): Observable<readonly AuthorChapterMediaPage[]> => {
          attached.push(pages[0].mediaAssetId);
          const snapshot = attached.map((id, index) => page(id, index));
          const subject = new Subject<readonly AuthorChapterMediaPage[]>();
          queueMicrotask(() => {
            subject.next(snapshot);
            subject.complete();
          });
          return subject.asObservable();
        },
      ),
    };

    TestBed.configureTestingModule({
      providers: [
        AuthorChapterEditorStore,
        { provide: AuthorStoryManagementRepository, useValue: repository },
      ],
    });
    store = TestBed.inject(AuthorChapterEditorStore);
  });

  /** Hoàn tất việc tải một ảnh rồi nhường cho chuỗi chạy tiếp. */
  async function settle(name: string, mediaAssetId: string): Promise<void> {
    const subject = uploads.get(name);
    if (!subject) throw new Error(`Chưa bắt đầu tải ${name}`);
    subject.next({ id: mediaAssetId } as AuthorStoryMedia);
    subject.complete();
    await Promise.resolve();
    await Promise.resolve();
  }

  it('starts the next image only after the previous one is attached', async () => {
    store
      .uploadPages('story', 'chapter', [file('a.webp'), file('b.webp'), file('c.webp')])
      .subscribe();

    expect([...uploads.keys()]).toEqual(['a.webp']);

    await settle('a.webp', 'media-a');
    expect([...uploads.keys()]).toEqual(['a.webp', 'b.webp']);

    await settle('b.webp', 'media-b');
    expect([...uploads.keys()]).toEqual(['a.webp', 'b.webp', 'c.webp']);

    await settle('c.webp', 'media-c');
    expect(attached).toEqual(['media-a', 'media-b', 'media-c']);
  });

  it('ends with every page visible without a reload', async () => {
    store.uploadPages('story', 'chapter', [file('a.webp'), file('b.webp')]).subscribe();

    await settle('a.webp', 'media-a');
    await settle('b.webp', 'media-b');

    expect(store.mediaPages().map((item) => item.mediaAssetId)).toEqual(['media-a', 'media-b']);
    expect(store.uploadingPage()).toBe(false);
  });

  it('reports a failed image and still uploads the rest', async () => {
    failFirstUpload = true;
    store.uploadPages('story', 'chapter', [file('a.webp'), file('b.webp')]).subscribe();
    await Promise.resolve();

    await settle('b.webp', 'media-b');

    expect(store.error()).not.toBeNull();
    expect(attached).toEqual(['media-b']);
    expect(store.uploadingPage()).toBe(false);
  });
});
