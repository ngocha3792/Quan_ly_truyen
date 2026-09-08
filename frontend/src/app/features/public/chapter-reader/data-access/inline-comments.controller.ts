import { inject, Injectable, signal } from '@angular/core';
import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import type {
  ChapterComment,
  ComicCommentRegion,
  TextSelectionAnchor,
} from '../domain/chapter-reader.models';
import { ChapterReaderRepository } from './chapter-reader.repository';
import { ChapterReaderStore } from './chapter-reader.store';
import { TextSelectionService } from './text-selection.service';

@Injectable()
export class InlineCommentsController {
  private readonly config = inject(APP_RUNTIME_CONFIG);
  private readonly repository = inject(ChapterReaderRepository);
  private readonly store = inject(ChapterReaderStore);
  private readonly selectionService = inject(TextSelectionService);
  readonly enabled = this.config.features.inlineCommentsEnabled;
  readonly toolbarPosition = signal<{ x: number; y: number } | null>(null);
  readonly selection = this.selectionService.current;
  readonly focusedBlockId = signal<string | null>(null);

  capture(container: HTMLElement, target: EventTarget | null): void {
    if (!this.enabled || !(target instanceof Node) || !container.contains(target)) return;
    const selection = this.selectionService.capture(container);
    this.toolbarPosition.set(
      selection
        ? {
            x: selection.rect.left + selection.rect.width / 2,
            y: selection.rect.top,
          }
        : null,
    );
  }

  openSelection(): void {
    const selection = this.selection();
    if (!selection) return;
    this.focusedBlockId.set(selection.startBlockId);
    this.toolbarPosition.set(null);
  }

  openBlock(blockId: string): void {
    this.selectionService.clear();
    this.toolbarPosition.set(null);
    this.focusedBlockId.set(blockId);
  }

  close(): void {
    this.focusedBlockId.set(null);
    this.selectionService.clear();
  }

  createAnchoredComment(body: string, anchor: TextSelectionAnchor): void {
    const view = this.store.view();
    const normalized = body.trim();
    if (!view || !normalized) return;
    const request = this.repository.createAnchoredComment(
      view.story.id,
      view.chapter.id,
      normalized,
      anchor,
    );
    this.store.prependCreatedComment(request, 'Không thể gửi bình luận theo đoạn.');
  }

  createComicRegionComment(mediaAssetId: string, body: string, region: ComicCommentRegion): void {
    const view = this.store.view();
    const normalized = body.trim();
    if (!view || !normalized) return;
    const request = this.repository.createComicRegionComment(
      view.story.id,
      view.chapter.id,
      mediaAssetId,
      normalized,
      region,
    );
    this.store.prependCreatedComment(request, 'Không thể gửi bình luận trên ảnh.');
  }

  count(comments: readonly ChapterComment[], blockId: string | null): number {
    return blockId
      ? comments.filter((comment) => comment.anchor?.startBlockId === blockId).length
      : 0;
  }
}
