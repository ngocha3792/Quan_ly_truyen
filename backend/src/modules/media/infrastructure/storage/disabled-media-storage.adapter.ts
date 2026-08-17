import { Injectable } from '@nestjs/common';
import type {
  DeleteStoredMediaResult,
  MediaStoragePort,
} from '../../application/ports/media-storage.port';
import type { SignedUploadParameters } from '../../application/ports/signed-upload.interface';
import type { StoredMedia } from '../../application/ports/stored-media.interface';
import { MediaStorageDisabledException } from '../../application/errors/media.exceptions';

@Injectable()
export class DisabledMediaStorageAdapter implements MediaStoragePort {
  private unavailable(): never {
    throw new MediaStorageDisabledException();
  }
  createSignedUpload(): SignedUploadParameters {
    return this.unavailable();
  }
  confirmUpload(): Promise<StoredMedia> {
    return this.unavailable();
  }
  uploadBuffer(): Promise<StoredMedia> {
    return this.unavailable();
  }
  delete(): Promise<DeleteStoredMediaResult> {
    return this.unavailable();
  }
  buildUrl(): string {
    return this.unavailable();
  }
}
