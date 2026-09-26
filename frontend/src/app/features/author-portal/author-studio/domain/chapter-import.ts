/** Một chương tách được từ file, chưa gửi lên máy chủ. */
export interface ParsedImportChapter {
  /** Số ghi trong file, chỉ để hiện ra cho tác giả đối chiếu. */
  readonly numberInFile: number;
  readonly title: string;
  readonly content: string;
  readonly wordCount: number;
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
  let preamble: string[] = [];
  let current: { numberInFile: number; title: string; body: string[] } | null = null;

  const flush = (): void => {
    if (!current) return;
    const content = current.body.join('\n').trim();
    chapters.push({
      numberInFile: current.numberInFile,
      title: current.title,
      content,
      wordCount: countWords(content),
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
