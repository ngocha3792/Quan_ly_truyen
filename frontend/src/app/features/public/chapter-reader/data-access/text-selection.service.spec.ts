import { TextSelectionService } from './text-selection.service';

describe('TextSelectionService', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('article');
    document.body.append(container);
  });

  afterEach(() => {
    window.getSelection()?.removeAllRanges();
    container.remove();
  });

  function capture(range: Range) {
    Object.defineProperty(range, 'getClientRects', {
      value: () => ({ item: () => ({ left: 10, top: 20, width: 30 }) }),
    });
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    return new TextSelectionService().capture(container);
  }

  it('converts a DOM selection into stable block-relative offsets', () => {
    container.innerHTML =
      '<p data-block-id="11111111-1111-4111-8111-111111111111"><strong>Một đoạn</strong> văn bản đủ dài</p>';
    const paragraph = container.querySelector('p')!;
    const first = paragraph.querySelector('strong')!.firstChild!;
    const second = paragraph.lastChild!;
    const range = document.createRange();
    range.setStart(first, 4);
    range.setEnd(second, 8);
    expect(capture(range)).toMatchObject({
      startOffset: 4,
      endOffset: 16,
      quoteText: 'đoạn văn bản',
    });
  });

  it('ends at the selected paragraph when the range ends at offset zero of the next block', () => {
    const quote =
      'Quả nhiên không lâu sau, tiếng bước chân lẹp xẹp vang lên từ xa. Kiyotaka đứng thẳng dậy.';
    container.innerHTML =
      '<div><p data-block-id="first"></p></div><div><p data-block-id="second">Đoạn văn tiếp theo.</p></div>';
    const [first, second] = container.querySelectorAll('p');
    first.textContent = quote;
    const range = document.createRange();
    range.setStart(first.firstChild!, 0);
    range.setEnd(second, 0);
    expect(capture(range)).toMatchObject({
      startBlockId: 'first',
      startOffset: 0,
      endBlockId: 'first',
      endOffset: quote.length,
      quoteText: quote,
    });
  });

  it('accepts wrapper boundaries and excludes comment badges from a multi-block quote', () => {
    container.innerHTML =
      '<div><p data-block-id="first">Đoạn văn thứ nhất.</p><button>12 bình luận</button></div><div><p data-block-id="second">Đoạn văn thứ hai.</p><button>3 bình luận</button></div>';
    const range = document.createRange();
    range.selectNodeContents(container);
    expect(capture(range)).toMatchObject({
      startBlockId: 'first',
      startOffset: 0,
      endBlockId: 'second',
      endOffset: 'Đoạn văn thứ hai.'.length,
      quoteText: 'Đoạn văn thứ nhất.\n\nĐoạn văn thứ hai.',
    });
  });

  it('preserves source whitespace and UTF-16 offsets inside a paragraph', () => {
    const text = '📖 Một  đoạn tiếng Việt đủ dài.\nDòng kế tiếp.';
    container.innerHTML = '<p data-block-id="first"></p>';
    const paragraph = container.querySelector('p')!;
    paragraph.textContent = text;
    const range = document.createRange();
    range.setStart(paragraph.firstChild!, 3);
    range.setEnd(paragraph.firstChild!, text.length);
    expect(capture(range)).toMatchObject({
      startOffset: 3,
      endOffset: text.length,
      quoteText: text.slice(3),
    });
  });

  it('does not anchor a selection containing only a comment badge', () => {
    container.innerHTML =
      '<p data-block-id="first">Đoạn văn đủ dài.</p><button>12 bình luận theo đoạn</button>';
    const range = document.createRange();
    range.selectNodeContents(container.querySelector('button')!);
    expect(capture(range)).toBeNull();
  });
});
