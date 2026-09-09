import { inject, Injectable, signal } from '@angular/core';
import {
  ChapterDraft,
  ChapterRecoveryEntry,
  ChapterRecoveryScope,
} from '../domain/chapter-editing.models';
import { chapterRecoveryKey, ChapterLocalRecoveryService } from './chapter-local-recovery.service';

@Injectable()
export class ChapterRecoveryQueueService {
  private readonly recovery = inject(ChapterLocalRecoveryService);
  private pending = Promise.resolve();
  readonly error = signal<string | null>(null);

  save(
    scope: ChapterRecoveryScope,
    draft: ChapterDraft,
    revision: number,
    baseVersion: number | null,
  ): void {
    const entry: ChapterRecoveryEntry = {
      ...scope,
      ...draft,
      key: chapterRecoveryKey(scope),
      revision,
      savedAt: Date.now(),
      baseVersion,
    };
    this.pending = this.pending
      .then(() => this.recovery.save(entry))
      .catch(() => {
        this.error.set(
          'Không thể lưu bản khôi phục trên thiết bị. Hãy lưu chương trước khi đóng tab.',
        );
      });
  }

  flush(): Promise<void> {
    return this.pending;
  }
  async discard(entries: readonly ChapterRecoveryEntry[]): Promise<void> {
    await Promise.all(
      entries.map((entry) => this.recovery.clearIfRevision(entry.key, entry.revision)),
    ).catch(() =>
      this.error.set(
        'Không thể xóa bản nháp cục bộ. Bạn có thể tiếp tục viết; bản cũ vẫn được giữ.',
      ),
    );
  }
  async confirmLeave(dirty: boolean, busy: boolean): Promise<boolean> {
    if (!dirty && !busy) return true;
    await this.flush();
    return window.confirm(
      this.error()
        ? 'Bản nháp chưa được lưu an toàn trên thiết bị. Rời trang vẫn có thể mất nội dung. Tiếp tục?'
        : 'Bạn có thay đổi chưa lưu lên máy chủ. Bản khôi phục được giữ trên thiết bị này. Rời trang?',
    );
  }
}
