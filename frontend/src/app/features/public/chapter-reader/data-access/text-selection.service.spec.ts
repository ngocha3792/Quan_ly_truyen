import { TextSelectionService } from './text-selection.service';

describe('TextSelectionService', () => {
  it('converts a DOM selection into stable block-relative offsets', () => {
    const container = document.createElement('article');
    container.innerHTML =
      '<p data-block-id="11111111-1111-4111-8111-111111111111"><strong>Một đoạn</strong> văn bản đủ dài</p>';
    document.body.append(container);
    const paragraph = container.querySelector('p')!;
    const first = paragraph.querySelector('strong')!.firstChild!;
    const second = paragraph.lastChild!;
    const range = document.createRange();
    range.setStart(first, 4);
    range.setEnd(second, 8);
    Object.defineProperty(range, 'getClientRects', {
      value: () => ({ item: () => ({ left: 10, top: 20, width: 30 }) }),
    });
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    expect(new TextSelectionService().capture(container)).toMatchObject({
      startOffset: 4,
      endOffset: 16,
      quoteText: 'đoạn văn bản',
    });
    container.remove();
  });
});
