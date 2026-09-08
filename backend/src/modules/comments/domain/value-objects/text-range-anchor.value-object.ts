import { createHash } from 'node:crypto';

export interface AnchorBlock {
  readonly id: string;
  readonly text: string;
}
export interface TextRangeAnchor {
  readonly startBlockId: string;
  readonly startOffset: number;
  readonly endBlockId: string;
  readonly endOffset: number;
  readonly quoteText: string;
  readonly quoteHash: string;
  readonly excerptBefore: string | null;
  readonly excerptAfter: string | null;
}

export type AnchorVerificationResult =
  | { readonly valid: true; readonly quoteText: string }
  | {
      readonly valid: false;
      readonly reason:
        | 'block_not_found'
        | 'invalid_order'
        | 'offset_out_of_bounds'
        | 'quote_mismatch';
    };

export function normalizeAnchorQuote(value: string): string {
  return value.normalize('NFC').replace(/\s+/gu, ' ').trim();
}

export function hashAnchorQuote(value: string): string {
  return createHash('sha256')
    .update(normalizeAnchorQuote(value), 'utf8')
    .digest('hex');
}

export function extractAnchorQuote(
  blocks: readonly AnchorBlock[],
  startBlockId: string,
  startOffset: number,
  endBlockId: string,
  endOffset: number,
): string | null {
  const start = blocks.findIndex((block) => block.id === startBlockId);
  const end = blocks.findIndex((block) => block.id === endBlockId);
  if (start < 0 || end < 0 || end < start) return null;
  if (
    startOffset < 0 ||
    endOffset < 0 ||
    startOffset > blocks[start].text.length ||
    endOffset > blocks[end].text.length
  )
    return null;
  if (start === end)
    return endOffset > startOffset
      ? blocks[start].text.slice(startOffset, endOffset)
      : null;
  return blocks
    .slice(start, end + 1)
    .map((block, index, selected) => {
      if (index === 0) return block.text.slice(startOffset);
      if (index === selected.length - 1) return block.text.slice(0, endOffset);
      return block.text;
    })
    .join('\n\n');
}

export function createTextRangeAnchor(
  blocks: readonly AnchorBlock[],
  startBlockId: string,
  startOffset: number,
  endBlockId: string,
  endOffset: number,
): TextRangeAnchor | null {
  const quoteText = extractAnchorQuote(
    blocks,
    startBlockId,
    startOffset,
    endBlockId,
    endOffset,
  );
  const normalized = quoteText ? normalizeAnchorQuote(quoteText) : '';
  if (!quoteText || normalized.length < 10 || normalized.length > 2000)
    return null;
  const start = blocks.find((block) => block.id === startBlockId)!;
  const end = blocks.find((block) => block.id === endBlockId)!;
  return {
    startBlockId,
    startOffset,
    endBlockId,
    endOffset,
    quoteText,
    quoteHash: hashAnchorQuote(quoteText),
    excerptBefore:
      start.text.slice(Math.max(0, startOffset - 100), startOffset) || null,
    excerptAfter: end.text.slice(endOffset, endOffset + 100) || null,
  };
}

export function verifyTextRangeAnchor(
  anchor: TextRangeAnchor,
  blocks: readonly AnchorBlock[],
): AnchorVerificationResult {
  const quoteText = extractAnchorQuote(
    blocks,
    anchor.startBlockId,
    anchor.startOffset,
    anchor.endBlockId,
    anchor.endOffset,
  );
  if (quoteText === null) {
    const hasStart = blocks.some((block) => block.id === anchor.startBlockId);
    const hasEnd = blocks.some((block) => block.id === anchor.endBlockId);
    return {
      valid: false,
      reason: !hasStart || !hasEnd ? 'block_not_found' : 'offset_out_of_bounds',
    };
  }
  if (hashAnchorQuote(quoteText) !== anchor.quoteHash)
    return { valid: false, reason: 'quote_mismatch' };
  return { valid: true, quoteText };
}

export function reanchorTextRange(
  anchor: TextRangeAnchor,
  blocks: readonly AnchorBlock[],
): TextRangeAnchor | null {
  if (verifyTextRangeAnchor(anchor, blocks).valid) return anchor;
  const preferred = blocks.find((block) => block.id === anchor.startBlockId);
  const candidates = preferred
    ? [preferred, ...blocks.filter((block) => block.id !== preferred.id)]
    : blocks;
  for (const block of candidates) {
    let from = 0;
    while (from <= block.text.length) {
      const index = block.text.indexOf(anchor.quoteText, from);
      if (index < 0) break;
      const before = block.text.slice(Math.max(0, index - 100), index);
      const after = block.text.slice(
        index + anchor.quoteText.length,
        index + anchor.quoteText.length + 100,
      );
      const contextMatches =
        (!anchor.excerptBefore || before.endsWith(anchor.excerptBefore)) &&
        (!anchor.excerptAfter || after.startsWith(anchor.excerptAfter));
      if (contextMatches)
        return createTextRangeAnchor(
          blocks,
          block.id,
          index,
          block.id,
          index + anchor.quoteText.length,
        );
      from = index + 1;
    }
  }
  return null;
}
