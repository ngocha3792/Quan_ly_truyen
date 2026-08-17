import type { BuildMediaUrlInput } from './media-storage.port';

export const MEDIA_URL_BUILDER = Symbol.for('quan-ly-truyen.modules.media-url-builder');

export interface MediaUrlPort {
  build(input: BuildMediaUrlInput): string;
}
