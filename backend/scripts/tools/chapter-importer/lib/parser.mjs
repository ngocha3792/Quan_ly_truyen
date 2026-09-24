/**
 * Generalized chapter-heading detection.
 *
 * Handles every heading style this tool has actually been fed:
 *   - "Chương 12: Title" / "Chapter 12 Title" / "Chương 12 — Title"
 *   - "### Chương 12: Title"        (markdown h1-h3)
 *   - "**Chương 12: Title**"        (bold-wrapped, closing ** optional/partial)
 *   - Named front/back matter with no number: "Lời mở đầu", "Ngoại truyện",
 *     "Hậu truyện", "Lời bạt", "Lời tựa", "Phiên ngoại", "Lời kết" (each
 *     counts as one chapter, matching how such sections are actually published)
 *   - A volume banner glued onto chapter 1's heading line, e.g.
 *     "Quyển thứ nhất ... ~ chương 1 Tên chương ~" (rescued as a special case)
 *
 * Chapter *numbers* in titles are cosmetic only — the site auto-assigns the
 * real `number` field by creation order, so mislabeled/reset/duplicated
 * numbers in the source text never break ordering. What DOES matter is
 * catching accidental duplicate content, which this module flags but does
 * not silently drop.
 */

const NUMBERED_KEYWORDS = ['Chương', 'Chapter'];

// Some sources spell chapter numbers out in Vietnamese words instead of
// digits ("Chương Một", "Chương Hai Mươi Mốt") — the exact value never
// matters (the server assigns the real sequential number), only recognizing
// the line as a heading does. This list covers compounds up to a few
// hundred, which is generous for anything a single volume would use.
const VI_NUMBER_WORDS = [
  'không', 'mốt', 'một', 'hai', 'ba', 'bốn', 'tư', 'năm', 'lăm', 'sáu',
  'bảy', 'tám', 'chín', 'mười', 'mươi', 'trăm', 'nghìn', 'ngàn', 'linh', 'lẻ',
];
const NAMED_SECTIONS = [
  'Lời mở đầu',
  'Mở đầu',
  'Lời tựa',
  'Lời nói đầu',
  'Lời giữa sách',
  'Hậu ký',
  'Ngoại truyện',
  'Phiên ngoại',
  'Hậu truyện',
  'Lời bạt',
  'Lời kết',
  'Kết truyện',
];

// "Chương" is sometimes qualified before the number (or with no number at
// all): "Chương Cuối" (final chapter, no number), "Chương Cuối 2" (a second
// final chapter — sequels/omnibus editions do this), "Chương Bí mật 1"
// (secret/bonus chapter N). Missing these silently merges everything after
// them into the previous chapter — this has actually happened.
const CHAPTER_QUALIFIERS = ['Cuối', 'Bí mật', 'Đặc biệt', 'Phụ', 'Ẩn'];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

const DECORATION = '(?:#{1,6}\\s*)?[*_~]{0,3}\\s*';
const NUMBERED_ALT = NUMBERED_KEYWORDS.map(escapeRegExp).join('|');
const NAMED_ALT = NAMED_SECTIONS.map(escapeRegExp).join('|');
const VI_NUMBER_ALT = VI_NUMBER_WORDS.map(escapeRegExp).join('|');
const QUALIFIER_ALT = CHAPTER_QUALIFIERS.map(escapeRegExp).join('|');
// A digit run, OR 1-5 Vietnamese number-words in a row (covers "Một" through
// compounds like "Hai Mươi Mốt" / "Một Trăm Linh Năm").
const NUMBER_VALUE = `(?:\\d+|(?:(?:${VI_NUMBER_ALT})\\s*){1,5})`;
// After "Chương "/"Chapter ": either a qualifier optionally followed by a
// number ("Cuối", "Cuối 2", "Bí mật 1"), or a bare number/word-number.
const CHAPTER_SUFFIX = `(?:(?:${QUALIFIER_ALT})(?:\\s+${NUMBER_VALUE})?|${NUMBER_VALUE})`;

// NOT "\b": JS regex word boundaries are ASCII-only ([A-Za-z0-9_]), so a
// keyword ending in an accented vowel with nothing after it — e.g. "Hậu ký"
// at end of line — silently fails to match "\b" even though it's clearly a
// complete word. "(?!\\p{L})" (not immediately followed by a letter) is the
// Unicode-safe equivalent and was needed for a real heading in testing.
const WORD_END = '(?!\\p{L})';
const NUMBERED_RE = new RegExp(`^${DECORATION}(?:${NUMBERED_ALT})\\s+${CHAPTER_SUFFIX}`, 'iu');
const NAMED_RE = new RegExp(`^${DECORATION}(?:${NAMED_ALT})${WORD_END}`, 'iu');
const ANY_NUMBERED_RE = new RegExp(`(?:${NUMBERED_ALT})\\s+${CHAPTER_SUFFIX}`, 'iu');
const ANY_NAMED_RE = new RegExp(`(?:${NAMED_ALT})${WORD_END}`, 'iu');

// Named sections can carry a long subtitle ("Ngoại truyện: <a whole
// descriptive clause>"), so this is a loose sanity cap against matching a
// keyword that opens an actual multi-sentence paragraph — NOT a "titles are
// short" assumption (a real length cap of 60 silently ate several genuine
// headings in testing and is exactly the kind of bug this cap must not
// reintroduce).
const MAX_NAMED_LINE_LENGTH = 200;

function isHeadingLine(trimmed) {
  if (NUMBERED_RE.test(trimmed)) return true;
  if (trimmed.length <= MAX_NAMED_LINE_LENGTH && NAMED_RE.test(trimmed)) return true;
  return false;
}

function cleanTitle(rawTitle) {
  return rawTitle
    .replace(/^[#*_~\s]+/u, '')
    .replace(/[#*_~\s]+$/u, '')
    .trim();
}

/**
 * @param {string} text raw file content
 * @param {{ customPattern?: string }} [options]
 * @returns {{ chapters: Array<{title: string, content: string}>, warnings: string[], patternSource: string }}
 */
export function parseChapters(text, options = {}) {
  const lines = text.replace(/\r\n?/gu, '\n').split('\n');
  const customRe = options.customPattern
    ? new RegExp(options.customPattern, 'iu')
    : null;
  const testHeading = customRe
    ? (trimmed) => customRe.test(trimmed)
    : isHeadingLine;

  const chapters = [];
  let currentTitle = null;
  let currentLines = [];
  let currentStartLine = 0;

  const flush = (endLine) => {
    if (currentTitle === null) return;
    chapters.push({
      title: cleanTitle(currentTitle),
      content: currentLines.join('\n').trim(),
      startLine: currentStartLine,
      endLine,
    });
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed && testHeading(trimmed)) {
      flush(index);
      currentTitle = trimmed;
      currentLines = [];
      currentStartLine = index + 1;
      return;
    }
    if (currentTitle !== null) currentLines.push(line);
  });
  flush(lines.length);

  const warnings = [];

  // Rescue the "volume banner glued onto chapter 1's heading" case: the very
  // first non-empty line contains a real heading keyword somewhere in it but
  // wasn't matched because it's prefixed by free text (e.g. "Quyển thứ
  // nhất ... ~ chương 1 ..."). Only ever needed on line 1, and only when
  // nothing was parsed before the first real chapter, or nothing parsed at all.
  if (!customRe) {
    const firstNonEmptyIndex = lines.findIndex((l) => l.trim().length > 0);
    if (firstNonEmptyIndex !== -1) {
      const firstLine = lines[firstNonEmptyIndex].trim();
      const alreadyCaptured =
        chapters.length > 0 && chapters[0].startLine === firstNonEmptyIndex + 1;
      const looksLikeBanner =
        !isHeadingLine(firstLine) &&
        firstLine.length <= 160 &&
        (ANY_NUMBERED_RE.test(firstLine) || (firstLine.length <= MAX_NAMED_LINE_LENGTH * 2 && ANY_NAMED_RE.test(firstLine)));

      if (looksLikeBanner && !alreadyCaptured) {
        // Re-parse treating this one line as an additional heading.
        const rescuedLines = [...lines];
        const rescued = [];
        let title = null;
        let body = [];
        let start = 0;
        const flushRescued = (endLine) => {
          if (title === null) return;
          rescued.push({
            title: cleanTitle(title),
            content: body.join('\n').trim(),
            startLine: start,
            endLine,
          });
        };
        rescuedLines.forEach((line, index) => {
          const trimmed = line.trim();
          const isFirstBanner = index === firstNonEmptyIndex;
          if (isFirstBanner || (trimmed && isHeadingLine(trimmed))) {
            flushRescued(index);
            title = trimmed;
            body = [];
            start = index + 1;
            return;
          }
          if (title !== null) body.push(line);
        });
        flushRescued(rescuedLines.length);

        if (rescued.length > chapters.length) {
          chapters.length = 0;
          chapters.push(...rescued);
          warnings.push(
            `Dòng đầu tiên chứa tiêu đề chương lồng trong văn bản khác ("${firstLine.slice(0, 80)}${firstLine.length > 80 ? '…' : ''}") — đã tự động tách thành chương riêng.`,
          );
        }
      }
    }
  }

  if (chapters.length === 0) {
    warnings.push(
      'Không phát hiện được tiêu đề chương nào với mẫu nhận diện hiện tại. Có thể cần chỉ định --pattern thủ công.',
    );
  }

  // Duplicate detection within this batch: same declared chapter number, or
  // (near-)identical title text, both point at accidentally pasted-twice content.
  const seenTitles = new Map();
  const seenNumbers = new Map();
  chapters.forEach((chapter, index) => {
    const normalizedTitle = chapter.title.toLowerCase().replace(/\s+/gu, ' ').trim();
    if (seenTitles.has(normalizedTitle)) {
      warnings.push(
        `Trùng tiêu đề: chương #${seenTitles.get(normalizedTitle) + 1} và #${index + 1} đều là "${chapter.title}".`,
      );
    } else {
      seenTitles.set(normalizedTitle, index);
    }

    const numberMatch = chapter.title.match(/\d+/u);
    if (numberMatch) {
      const num = numberMatch[0];
      if (seenNumbers.has(num)) {
        warnings.push(
          `Trùng số chương ${num}: chương #${seenNumbers.get(num) + 1} ("${chapters[seenNumbers.get(num)].title}") và #${index + 1} ("${chapter.title}").`,
        );
      } else {
        seenNumbers.set(num, index);
      }
    }
  });

  // Sanity-check chapter sizes: a chapter under ~40 chars of content is
  // usually a mis-split heading rather than real prose (except deliberately
  // tiny sections like a one-line "Lời bạt").
  chapters.forEach((chapter, index) => {
    if (chapter.content.length < 20) {
      warnings.push(
        `Chương #${index + 1} ("${chapter.title}") gần như trống (${chapter.content.length} ký tự) — kiểm tra lại mẫu nhận diện.`,
      );
    }
  });

  return {
    chapters: chapters.map(({ title, content }) => ({ title, content })),
    warnings,
    patternSource: customRe
      ? customRe.source
      : `${NUMBERED_RE.source} | ${NAMED_RE.source}`,
  };
}

export function parseMultipleFiles(fileTexts, options = {}) {
  let all = [];
  const warnings = [];
  for (const text of fileTexts) {
    const result = parseChapters(text, options);
    all = all.concat(result.chapters);
    warnings.push(...result.warnings);
  }
  return { chapters: all, warnings };
}
