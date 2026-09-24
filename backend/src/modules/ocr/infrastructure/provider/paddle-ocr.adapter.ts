import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { OcrConfig } from '@/config';
import { OCR_CONFIG_KEY } from '@/config';

import type {
  OcrProviderPort,
  OcrRecognisePage,
  OcrRecognisedPage,
} from '../../application';
import {
  clampConfidence,
  normaliseOcrBox,
  OCR_LANGUAGES,
  OcrProviderException,
  sanitiseOcrText,
  type OcrLine,
} from '../../domain';

interface RemoteLine {
  text?: unknown;
  confidence?: unknown;
  box?: unknown;
}

interface RemoteResult {
  lines?: unknown;
}

@Injectable()
export class PaddleOcrAdapter implements OcrProviderPort {
  readonly supportedLanguages = OCR_LANGUAGES;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  get maxBatchSize(): number {
    return this.settings().maxBatchSize;
  }

  async recognise(
    pages: readonly OcrRecognisePage[],
    language: string,
  ): Promise<readonly OcrRecognisedPage[]> {
    const results: OcrRecognisedPage[] = [];

    // One page per request: the host serialises recognition behind a single
    // engine anyway, and per-page requests keep one unreadable image from
    // failing the whole chapter.
    for (const page of pages) {
      results.push(await this.recognisePage(page, language));
    }

    return results;
  }

  private async recognisePage(
    page: OcrRecognisePage,
    language: string,
  ): Promise<OcrRecognisedPage> {
    const settings = this.settings();
    const image = await this.download(page.imageUrl, settings);
    const form = new FormData();
    form.append('file', new Blob([image.buffer]), `${page.mediaAssetId}.img`);

    const url = new URL('/ocr', settings.baseUrl);
    url.searchParams.set('lang', language);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'x-api-key': settings.apiKey },
        body: form,
        signal: AbortSignal.timeout(settings.requestTimeoutMs),
      });
    } catch (error) {
      throw new OcrProviderException(
        error instanceof Error
          ? error.message
          : 'Không thể kết nối dịch vụ OCR',
      );
    }

    if (!response.ok) {
      throw new OcrProviderException(
        `Dịch vụ OCR trả HTTP ${response.status}`,
        response.status >= 500 || response.status === 429,
      );
    }

    const body = (await response.json()) as RemoteResult;
    const lines = this.mapLines(body.lines, image.width, image.height);

    return {
      mediaAssetId: page.mediaAssetId,
      lines,
      text: lines.map((line) => line.text).join('\n'),
    };
  }

  private mapLines(
    value: unknown,
    width: number,
    height: number,
  ): readonly OcrLine[] {
    if (!Array.isArray(value)) return [];

    const lines: OcrLine[] = [];
    for (const raw of value as RemoteLine[]) {
      const text = sanitiseOcrText(raw.text);
      if (!text) continue;

      const polygon = toPolygon(raw.box);
      const box = polygon ? normaliseOcrBox(polygon, width, height) : null;
      if (!box) continue;

      lines.push({ text, confidence: clampConfidence(raw.confidence), box });
    }
    return lines;
  }

  private async download(
    imageUrl: string,
    settings: OcrConfig,
  ): Promise<{ buffer: ArrayBuffer; width: number; height: number }> {
    let response: Response;
    try {
      response = await fetch(imageUrl, {
        signal: AbortSignal.timeout(settings.requestTimeoutMs),
      });
    } catch (error) {
      throw new OcrProviderException(
        error instanceof Error ? error.message : 'Không tải được ảnh trang',
      );
    }
    if (!response.ok) {
      throw new OcrProviderException(
        `Không tải được ảnh trang: HTTP ${response.status}`,
        response.status >= 500,
      );
    }

    const buffer = await response.arrayBuffer();
    if (!buffer.byteLength || buffer.byteLength > settings.maxImageBytes) {
      throw new OcrProviderException(
        'Kích thước ảnh trang không hợp lệ',
        false,
      );
    }

    const size = readImageSize(new Uint8Array(buffer));
    if (!size) {
      throw new OcrProviderException('Không đọc được kích thước ảnh', false);
    }

    return { buffer, ...size };
  }

  private settings(): OcrConfig {
    return this.config.getOrThrow<OcrConfig>(OCR_CONFIG_KEY);
  }
}

function toPolygon(value: unknown): (readonly [number, number])[] | null {
  if (!Array.isArray(value)) return null;

  const polygon: [number, number][] = [];
  for (const point of value as unknown[]) {
    if (!Array.isArray(point) || point.length < 2) return null;
    const x = Number((point as unknown[])[0]);
    const y = Number((point as unknown[])[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    polygon.push([x, y]);
  }
  return polygon.length ? polygon : null;
}

/**
 * Boxes come back in pixels, so the page size is needed to normalise them.
 * Reading the PNG/JPEG header avoids pulling an image library into the API for
 * two numbers.
 */
function readImageSize(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const isPng =
    bytes.length > 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  if (isPng) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }

  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1] ?? 0;
      const length = view.getUint16(offset + 2);
      const isSizeFrame =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc;
      if (isSizeFrame) {
        return {
          height: view.getUint16(offset + 5),
          width: view.getUint16(offset + 7),
        };
      }
      offset += 2 + length;
    }
  }

  return null;
}
