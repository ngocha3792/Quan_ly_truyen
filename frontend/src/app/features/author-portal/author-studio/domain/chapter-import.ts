/** Một chương tách được từ file, chưa gửi lên máy chủ. */
export interface ParsedImportChapter {
  /** Số ghi trong file, chỉ để hiện ra cho tác giả đối chiếu. */
  readonly numberInFile: number;
  readonly title: string;
  readonly content: string;
  readonly wordCount: number;
  /**
   * Chỉ số ảnh mà nội dung chương này đang trỏ tới, theo thứ tự xuất hiện.
   *
   * Ảnh chỉ tải lên được sau khi chương đã tồn tại (upload-intent lấy chapterId
   * làm chủ sở hữu), nên lúc tách chỉ ghi lại chương nào cần ảnh nào.
   */
  readonly imageIndexes: readonly number[];
}

export interface ChapterImportParseResult {
  readonly chapters: readonly ParsedImportChapter[];
  /**
   * Chữ nằm trước tiêu đề chương đầu tiên.
   *
   * Không tự gán nó vào chương nào: nuốt im lặng một đoạn văn bản là cách chắc
   * chắn để tác giả mất bài mà không biết. Giao diện hiện ra để họ tự quyết.
   */
  readonly ignoredPreamble: string;
}

/**
 * Dòng mở đầu một chương.
 *
 * Bắt "Chương 12: Tên", và nới ra vài kiểu gõ thường gặp: không dấu
 * ("Chuong 12"), số thập phân ("Chương 1.5" cho chương chèn giữa), dấu ngăn là
 * `:` `.` `-` hay gạch dài, và chương không có tên.
 */
const CHAPTER_HEADING = /^[ \t]*ch(?:ương|uong)[ \t]+(\d+(?:[.,]\d+)?)[ \t]*[:.\-–—]?[ \t]*(.*)$/i;

/*
 * Placeholder đứng thay URL ảnh cho tới khi ảnh được tải lên.
 *
 * Nằm trong cú pháp ảnh markdown (`![alt](...)`) chứ không phải một ký hiệu
 * riêng, để bộ tách chương không cần biết gì về ảnh: với nó đây chỉ là một dòng
 * chữ như mọi dòng khác. Tiền tố dài và có tiền tố dự án để không đụng vào
 * đường dẫn thật mà tác giả tự gõ.
 */
const IMAGE_PLACEHOLDER_PREFIX = 'qlt-anh-nhap-';

/**
 * Dựng mới mỗi lần gọi thay vì dùng chung một hằng số.
 *
 * Regex có cờ `g` mang theo `lastIndex`; chia sẻ giữa `matchAll` và `replace`
 * là mở đường cho lỗi phụ thuộc thứ tự gọi, loại lỗi chỉ hiện ra khi chạy thật.
 */
function placeholderPattern(): RegExp {
  return new RegExp(`!\\[[^\\]]*\\]\\(${IMAGE_PLACEHOLDER_PREFIX}(\\d+)\\)`, 'g');
}

/** URL tạm cho ảnh thứ `index` đọc được từ file. */
export function imagePlaceholder(index: number): string {
  return `${IMAGE_PLACEHOLDER_PREFIX}${index}`;
}

/** Chỉ số ảnh mà nội dung này trỏ tới, theo thứ tự xuất hiện, không trùng lặp. */
export function readImageIndexes(content: string): readonly number[] {
  const found = new Set<number>();

  for (const match of content.matchAll(placeholderPattern())) {
    found.add(Number(match[1]));
  }

  return [...found];
}

/**
 * Đổi placeholder thành URL thật sau khi ảnh đã lên CDN.
 *
 * Ảnh nào không có URL — tải lên thất bại — thì **xoá hẳn** tham chiếu, không
 * để lại placeholder. Giữ lại là chương xuất bản ra với một tấm ảnh hỏng, còn
 * tệ hơn là thiếu ảnh; nơi gọi có nhiệm vụ báo cho tác giả biết ảnh nào mất.
 */
export function resolveImagePlaceholders(
  content: string,
  urlByIndex: ReadonlyMap<number, string>,
): string {
  const kept: string[] = [];
  let dropped = false;

  for (const line of content.split('\n')) {
    const carriedImage = placeholderPattern().test(line);
    const resolved = line.replace(placeholderPattern(), (whole, rawIndex: string) => {
      const url = urlByIndex.get(Number(rawIndex));
      return url ? whole.replace(imagePlaceholder(Number(rawIndex)), url) : '';
    });

    /*
     * Dòng vốn chỉ có ảnh mà ảnh đã mất thì bỏ luôn cả dòng. Để lại một dòng
     * trống mới là tự thêm khoảng hở vào bản thảo của tác giả.
     */
    if (carriedImage && resolved.trim() === '') {
      dropped = true;
      continue;
    }

    kept.push(resolved);
  }

  const joined = kept.join('\n').trim();

  /*
   * Bỏ một dòng ảnh làm hai dấu ngắt đoạn nằm cạnh nhau. Chỉ gộp khi thật sự
   * đã bỏ dòng, để không sửa khoảng cách mà tác giả cố ý gõ.
   */
  return dropped ? joined.replace(/\n{3,}/g, '\n\n') : joined;
}

/** Tên đặt cho chương không ghi tên trong file. */
function fallbackTitle(numberInFile: number): string {
  return `Chương ${numberInFile}`;
}

/**
 * Tách một bản thảo thành các chương theo dòng tiêu đề.
 *
 * Chỉ tách, không quyết định số chương thật: máy chủ đánh số khi tạo, nên
 * `numberInFile` chỉ để tác giả đối chiếu trong bản xem trước.
 */
export function parseChaptersFromText(raw: string): ChapterImportParseResult {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n');
  const chapters: ParsedImportChapter[] = [];
  const preamble: string[] = [];
  let current: { numberInFile: number; title: string; body: string[] } | null = null;

  const flush = (): void => {
    if (!current) return;
    const content = current.body.join('\n').trim();
    chapters.push({
      numberInFile: current.numberInFile,
      title: current.title,
      content,
      wordCount: countWords(content),
      imageIndexes: readImageIndexes(content),
    });
  };

  for (const line of lines) {
    const heading = CHAPTER_HEADING.exec(line);

    if (!heading) {
      if (current) current.body.push(line);
      else preamble.push(line);
      continue;
    }

    flush();
    const numberInFile = Number(heading[1].replace(',', '.'));
    current = {
      numberInFile,
      title: heading[2].trim() || fallbackTitle(numberInFile),
      body: [],
    };
  }

  flush();

  return { chapters, ignoredPreamble: preamble.join('\n').trim() };
}

function countWords(content: string): number {
  return content.split(/\s+/).filter(Boolean).length;
}

/** Một chương đã tạo trên máy chủ, ghép với chương đã tách ở trình duyệt. */
export interface PairedImportChapter<TCreated> {
  readonly created: TCreated;
  readonly parsed: ParsedImportChapter;
}

/**
 * Ghép chương máy chủ vừa tạo với chương tương ứng đã tách ở trình duyệt.
 *
 * Máy chủ xử lý theo đúng thứ tự gửi lên, nhưng `created` đã lược các chương bị
 * bỏ, và nó còn có thể dừng sớm giữa lô (truyện không còn thì các chương sau
 * hỏng y hệt) — khi đó `created` ngắn hơn cả phần chưa bị bỏ. Ghép lệch một
 * nhịp là ảnh của chương này nhảy sang chương khác, nên chỗ này tính bằng chỉ
 * số thật chứ không dựa vào độ dài hai danh sách bằng nhau.
 */
export function pairCreatedChapters<TCreated>(
  batch: readonly ParsedImportChapter[],
  created: readonly TCreated[],
  skippedIndexes: readonly number[],
): readonly PairedImportChapter<TCreated>[] {
  const skipped = new Set(skippedIndexes);
  const submitted = batch.filter((_chapter, index) => !skipped.has(index));

  // `created` dài hơn phần đã gửi là máy chủ trả về thứ không khớp yêu cầu;
  // thà ghép thiếu còn hơn ghép sai chương.
  return created
    .slice(0, submitted.length)
    .map((item, position) => ({ created: item, parsed: submitted[position] }));
}
