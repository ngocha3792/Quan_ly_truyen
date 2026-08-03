export type CookieHeaderReadResult =
  | Readonly<{
      status: 'missing';
    }>
  | Readonly<{
      status: 'valid';

      value: string;
    }>
  | Readonly<{
      status: 'malformed';
    }>
  | Readonly<{
      status: 'duplicate';
    }>;

/**
 * Đọc đúng một cookie từ raw Cookie header.
 *
 * Không dùng object cookie đã parse sẵn vì các parser khác nhau
 * có thể xử lý duplicate cookie theo cách khác nhau:
 *
 * - lấy cookie đầu tiên;
 * - lấy cookie cuối cùng;
 * - ghi đè giá trị;
 * - bỏ qua toàn bộ.
 *
 * Với credential cookie, duplicate phải được nhận diện rõ
 * và từ chối thay vì tự chọn một giá trị.
 */
export function readCookieFromHeader(
  cookieHeader: string | undefined,

  cookieName: string,
): CookieHeaderReadResult {
  if (!cookieHeader) {
    return {
      status: 'missing',
    };
  }

  let matchCount = 0;

  let value: string | undefined;

  let malformed = false;

  for (const rawPart of cookieHeader.split(';')) {
    const part = rawPart.trim();

    if (!part) {
      continue;
    }

    const separatorIndex = part.indexOf('=');

    /*
     * Cookie không có dấu "=".
     *
     * Chỉ coi là malformed nếu phần đó chính là cookie
     * đang cần tìm. Cookie khác bị malformed không làm
     * credential cookie của chúng ta mất hiệu lực.
     */
    if (separatorIndex < 0) {
      if (part === cookieName) {
        matchCount += 1;

        malformed = true;
      }

      continue;
    }

    const name = part.slice(0, separatorIndex).trim();

    if (name !== cookieName) {
      continue;
    }

    matchCount += 1;

    /*
     * Vẫn tiếp tục quét toàn bộ header để duplicate luôn
     * được ưu tiên nhận diện, kể cả một bản sao bị malformed.
     */
    if (matchCount > 1) {
      continue;
    }

    const encodedValue = part.slice(separatorIndex + 1).trim();

    if (!encodedValue) {
      malformed = true;

      continue;
    }

    try {
      const decodedValue = decodeURIComponent(encodedValue).trim();

      if (!decodedValue) {
        malformed = true;

        continue;
      }

      value = decodedValue;
    } catch {
      malformed = true;
    }
  }

  if (matchCount === 0) {
    return {
      status: 'missing',
    };
  }

  if (matchCount > 1) {
    return {
      status: 'duplicate',
    };
  }

  if (malformed || value === undefined) {
    return {
      status: 'malformed',
    };
  }

  return {
    status: 'valid',

    value,
  };
}
