import type { MediaStorageResourceType } from '../ports/stored-media.interface';

export interface ConfirmMediaUploadInput {
  readonly publicId: string;
  readonly version: number;
  readonly signature: string;
  readonly resourceType: MediaStorageResourceType;
}
