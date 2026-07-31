export interface StoredFile {
  id: string;

  storageProvider: 'local' | 's3' | 'gcs';
  storageKey: string;

  originalName: string;
  mimeType: string;
  size: number;

  url?: string;
  checksum?: string;

  createdAt: Date;
}
