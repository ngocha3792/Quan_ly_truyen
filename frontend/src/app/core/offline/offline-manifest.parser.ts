import type {
  OfflineContentBlock,
  OfflineContentDocument,
  OfflineContentMark,
  OfflineManifestChapter,
  OfflineManifestMedia,
  OfflineManifestSlice,
  OfflinePackageManifest,
  OfflinePackageStatus,
} from './offline.models';

const PACKAGE_STATUSES: readonly OfflinePackageStatus[] = [
  'PREPARING',
  'READY',
  'EXPIRED',
  'REVOKED',
];
const BLOCK_TYPES: readonly OfflineContentBlock['type'][] = [
  'paragraph',
  'heading',
  'blockquote',
  'list',
  'code',
  'horizontal_rule',
];
const MARK_TYPES: readonly OfflineContentMark['type'][] = ['bold', 'italic', 'code', 'link'];

export function parseOfflinePackageManifest(value: unknown): OfflinePackageManifest {
  const record = readRecord(value, 'manifest');
  const chapters = readArray(record, 'chapters').map((item, index) =>
    parseChapter(item, `chapters[${index}]`),
  );
  const chapterCount = readNonNegativeInteger(record, 'chapterCount');
  if (chapterCount !== chapters.length) {
    throw invalid('chapterCount không khớp danh sách chương');
  }

  return {
    packageId: readNonEmptyString(record, 'packageId'),
    name: readNonEmptyString(record, 'name'),
    description: readNullableString(record, 'description'),
    status: readEnum(record, 'status', PACKAGE_STATUSES),
    licenseExpiresAt: readDate(record, 'licenseExpiresAt'),
    createdAt: readDate(record, 'createdAt'),
    totalSizeBytes: readUnsignedIntegerString(record, 'totalSizeBytes'),
    chapterCount,
    chapters,
  };
}

function parseChapter(value: unknown, path: string): OfflineManifestChapter {
  const record = readRecord(value, path);
  const story = readRecord(record['story'], `${path}.story`);
  const access = readRecord(record['access'], `${path}.access`);

  return {
    chapterId: readNonEmptyString(record, 'chapterId', path),
    story: {
      id: readNonEmptyString(story, 'id', `${path}.story`),
      slug: readNonEmptyString(story, 'slug', `${path}.story`),
      title: readNonEmptyString(story, 'title', `${path}.story`),
    },
    number: readPositiveNumber(record, 'number', path),
    title: readNonEmptyString(record, 'title', path),
    slug: readNonEmptyString(record, 'slug', path),
    chapterVersion: readPositiveInteger(record, 'chapterVersion', path),
    content: readString(record, 'content', path),
    contentFormat: readNonEmptyString(record, 'contentFormat', path),
    contentDocument: parseContentDocument(record['contentDocument'], `${path}.contentDocument`),
    documentSchemaVersion: readPositiveInteger(record, 'documentSchemaVersion', path),
    access: {
      type: readEnum(access, 'type', ['FREE', 'PAID'] as const, `${path}.access`),
      state: readEnum(access, 'state', ['FREE', 'ENTITLED'] as const, `${path}.access`),
      priceCredits: readNullableString(access, 'priceCredits', `${path}.access`),
      entitlementId: readNullableString(access, 'entitlementId', `${path}.access`),
    },
    media: readArray(record, 'media', path).map((item, index) =>
      parseMedia(item, `${path}.media[${index}]`),
    ),
    wordCount: readNonNegativeInteger(record, 'wordCount', path),
    publishedAt: readDate(record, 'publishedAt', path),
    snapshotAt: readDate(record, 'snapshotAt', path),
  };
}

function parseMedia(value: unknown, path: string): OfflineManifestMedia {
  const record = readRecord(value, path);
  return {
    mediaAssetId: readNonEmptyString(record, 'mediaAssetId', path),
    sortOrder: readNonNegativeInteger(record, 'sortOrder', path),
    altText: readNullableString(record, 'altText', path),
    caption: readNullableString(record, 'caption', path),
    width: readPositiveInteger(record, 'width', path),
    height: readPositiveInteger(record, 'height', path),
    slices: readArray(record, 'slices', path).map((item, index) =>
      parseSlice(item, `${path}.slices[${index}]`),
    ),
  };
}

function parseSlice(value: unknown, path: string): OfflineManifestSlice {
  const record = readRecord(value, path);
  const urls = readRecord(record['urls'], `${path}.urls`);
  return {
    id: readNonEmptyString(record, 'id', path),
    sliceIndex: readNonNegativeInteger(record, 'sliceIndex', path),
    width: readPositiveInteger(record, 'width', path),
    height: readPositiveInteger(record, 'height', path),
    offsetY: readNonNegativeNumber(record, 'offsetY', path),
    aspectRatio: readPositiveNumber(record, 'aspectRatio', path),
    urls: {
      avif: readUrl(urls, 'avif', `${path}.urls`),
      webp: readUrl(urls, 'webp', `${path}.urls`),
      jpeg: readUrl(urls, 'jpeg', `${path}.urls`),
    },
  };
}

function parseContentDocument(value: unknown, path: string): OfflineContentDocument {
  const record = readRecord(value, path);
  if (record['schemaVersion'] !== 1) throw invalid(`${path}.schemaVersion không được hỗ trợ`);
  return {
    schemaVersion: 1,
    blocks: readArray(record, 'blocks', path).map((item, index) => {
      const blockPath = `${path}.blocks[${index}]`;
      const block = readRecord(item, blockPath);
      return {
        id: readNonEmptyString(block, 'id', blockPath),
        type: readEnum(block, 'type', BLOCK_TYPES, blockPath),
        text: readString(block, 'text', blockPath),
        marks: readArray(block, 'marks', blockPath).map((mark, markIndex) =>
          parseMark(mark, `${blockPath}.marks[${markIndex}]`),
        ),
      };
    }),
  };
}

function parseMark(value: unknown, path: string): OfflineContentMark {
  const record = readRecord(value, path);
  const type = readEnum(record, 'type', MARK_TYPES, path);
  const href = record['href'];
  if (href !== undefined && typeof href !== 'string') throw invalid(`${path}.href không hợp lệ`);
  return {
    type,
    from: readNonNegativeInteger(record, 'from', path),
    to: readNonNegativeInteger(record, 'to', path),
    ...(href === undefined ? {} : { href }),
  };
}

function readRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalid(`${path} không hợp lệ`);
  }
  return value as Record<string, unknown>;
}

function readArray(record: Record<string, unknown>, key: string, path = ''): readonly unknown[] {
  const value = record[key];
  if (!Array.isArray(value)) throw invalid(`${join(path, key)} không hợp lệ`);
  return value;
}

function readString(record: Record<string, unknown>, key: string, path = ''): string {
  const value = record[key];
  if (typeof value !== 'string') throw invalid(`${join(path, key)} không hợp lệ`);
  return value;
}

function readNonEmptyString(record: Record<string, unknown>, key: string, path = ''): string {
  const value = readString(record, key, path);
  if (!value.trim()) throw invalid(`${join(path, key)} không được để trống`);
  return value;
}

function readNullableString(
  record: Record<string, unknown>,
  key: string,
  path = '',
): string | null {
  const value = record[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw invalid(`${join(path, key)} không hợp lệ`);
  return value;
}

function readDate(record: Record<string, unknown>, key: string, path = ''): string {
  const value = readNonEmptyString(record, key, path);
  if (!Number.isFinite(Date.parse(value))) throw invalid(`${join(path, key)} không hợp lệ`);
  return value;
}

function readNonNegativeInteger(record: Record<string, unknown>, key: string, path = ''): number {
  const value = record[key];
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw invalid(`${join(path, key)} không hợp lệ`);
  }
  return value as number;
}

function readPositiveInteger(record: Record<string, unknown>, key: string, path = ''): number {
  const value = readNonNegativeInteger(record, key, path);
  if (value < 1) throw invalid(`${join(path, key)} không hợp lệ`);
  return value;
}

function readNonNegativeNumber(record: Record<string, unknown>, key: string, path = ''): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw invalid(`${join(path, key)} không hợp lệ`);
  }
  return value;
}

function readPositiveNumber(record: Record<string, unknown>, key: string, path = ''): number {
  const value = readNonNegativeNumber(record, key, path);
  if (value <= 0) throw invalid(`${join(path, key)} không hợp lệ`);
  return value;
}

function readUnsignedIntegerString(
  record: Record<string, unknown>,
  key: string,
  path = '',
): string {
  const value = readNonEmptyString(record, key, path);
  if (!/^\d+$/.test(value)) throw invalid(`${join(path, key)} không hợp lệ`);
  return value;
}

function readUrl(record: Record<string, unknown>, key: string, path: string): string {
  const value = readNonEmptyString(record, key, path);
  try {
    const parsed = new URL(value, 'https://offline.invalid');
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error();
  } catch {
    throw invalid(`${join(path, key)} không phải URL HTTP(S)`);
  }
  return value;
}

function readEnum<T extends string>(
  record: Record<string, unknown>,
  key: string,
  values: readonly T[],
  path = '',
): T {
  const value = record[key];
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw invalid(`${join(path, key)} không hợp lệ`);
  }
  return value as T;
}

function join(path: string, key: string): string {
  return path ? `${path}.${key}` : key;
}

function invalid(detail: string): Error {
  return new Error(`Offline package manifest: ${detail}.`);
}
