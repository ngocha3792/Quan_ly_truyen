import { StoredFile } from './stored-file.interface';

export interface FileUploadResult {
    file: StoredFile;

    variants?: ReadonlyArray<{
        name: string;
        storageKey: string;
        width?: number;
        height?: number;
        url?: string;
    }>;
}