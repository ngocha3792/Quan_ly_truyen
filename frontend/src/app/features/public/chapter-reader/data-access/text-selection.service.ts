import { Injectable, signal } from '@angular/core';
import type { TextSelectionAnchor } from '../domain/chapter-reader.models';

export interface CapturedTextSelection extends TextSelectionAnchor {
  readonly rect: { readonly left: number; readonly top: number; readonly width: number };
}

@Injectable()
export class TextSelectionService {
  private readonly currentState = signal<CapturedTextSelection | null>(null);
  readonly current = this.currentState.asReadonly();

  capture(container: HTMLElement): CapturedTextSelection | null {
    const selection = container.ownerDocument.defaultView?.getSelection();
    if (!selection || selection.rangeCount !== 1 || selection.isCollapsed) return this.clear();
    const range = selection.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) return this.clear();
    const parts = [...container.querySelectorAll<HTMLElement>('[data-block-id]')]
      .filter((block) => range.intersectsNode(block))
      .map((block) => selectedPart(block, range))
      .filter((part) => part.endOffset > part.startOffset);
    const start = parts[0];
    const end = parts.at(-1);
    // Browser Selection text adds layout newlines and may include comment
    // badges. The server uses source text joined by two newlines instead.
    const quoteText = parts.map((part) => part.text).join('\n\n');
    if (
      !start ||
      !end ||
      quoteText.normalize('NFC').replace(/\s+/gu, ' ').trim().length < 10 ||
      quoteText.length > 2000
    )
      return this.clear();
    const captured: CapturedTextSelection = {
      startBlockId: start.id,
      startOffset: start.startOffset,
      endBlockId: end.id,
      endOffset: end.endOffset,
      quoteText,
      rect: pickRect(range),
    };
    this.currentState.set(captured);
    return captured;
  }

  clear(): null {
    this.currentState.set(null);
    return null;
  }
}

function selectedPart(block: HTMLElement, selection: Range) {
  const intersection = block.ownerDocument.createRange();
  intersection.selectNodeContents(block);
  if (selection.compareBoundaryPoints(Range.START_TO_START, intersection) > 0)
    intersection.setStart(selection.startContainer, selection.startOffset);
  if (selection.compareBoundaryPoints(Range.END_TO_END, intersection) < 0)
    intersection.setEnd(selection.endContainer, selection.endOffset);
  const startOffset = offsetWithin(block, intersection.startContainer, intersection.startOffset);
  const endOffset = offsetWithin(block, intersection.endContainer, intersection.endOffset);
  return {
    id: block.dataset['blockId']!,
    startOffset,
    endOffset,
    text: (block.textContent ?? '').slice(startOffset, endOffset),
  };
}

function offsetWithin(block: HTMLElement, node: Node, offset: number): number {
  const range = block.ownerDocument.createRange();
  range.selectNodeContents(block);
  range.setEnd(node, offset);
  return range.toString().length;
}

function pickRect(range: Range): CapturedTextSelection['rect'] {
  const rects = range.getClientRects();
  const rect = rects.item(0) ?? range.getBoundingClientRect();
  return { left: rect.left, top: rect.top, width: rect.width };
}
