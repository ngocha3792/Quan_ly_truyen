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
    const startBlock = closestBlock(range.startContainer, container);
    const endBlock = closestBlock(range.endContainer, container);
    const startBlockId = startBlock?.dataset['blockId'];
    const endBlockId = endBlock?.dataset['blockId'];
    const quoteText = selection.toString();
    if (!startBlock || !endBlock || !startBlockId || !endBlockId || quoteText.trim().length < 10 || quoteText.trim().length > 2000) return this.clear();
    const captured: CapturedTextSelection = {
      startBlockId,
      startOffset: offsetWithin(startBlock, range.startContainer, range.startOffset),
      endBlockId,
      endOffset: offsetWithin(endBlock, range.endContainer, range.endOffset),
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

function closestBlock(node: Node, container: HTMLElement): HTMLElement | null {
  const element = node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement;
  const block = element?.closest<HTMLElement>('[data-block-id]') ?? null;
  return block && container.contains(block) ? block : null;
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
