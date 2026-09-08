import { inject, Injectable, signal } from '@angular/core';
import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import type { ChapterComment } from '../domain/chapter-reader.models';
import { TextSelectionService } from './text-selection.service';

@Injectable()
export class InlineCommentsController {
  private readonly config = inject(APP_RUNTIME_CONFIG);
  private readonly selectionService = inject(TextSelectionService);
  readonly enabled = this.config.features.inlineCommentsEnabled;
  readonly toolbarPosition = signal<{ x: number; y: number } | null>(null);
  readonly selection = this.selectionService.current;
  readonly focusedBlockId = signal<string | null>(null);

  capture(container: HTMLElement, target: EventTarget | null): void {
    if (!this.enabled || !(target instanceof Node) || !container.contains(target)) return;
    const selection = this.selectionService.capture(container);
    this.toolbarPosition.set(selection ? {
      x: selection.rect.left + selection.rect.width / 2,
      y: selection.rect.top,
    } : null);
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

  count(comments: readonly ChapterComment[], blockId: string | null): number {
    return blockId ? comments.filter((comment) => comment.anchor?.startBlockId === blockId).length : 0;
  }
}
