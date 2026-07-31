export interface UploadedFile {
    fieldName: string;
    originalName: string;
    mimeType: string;
    encoding?: string;
    size: number;

    buffer: Buffer;
}