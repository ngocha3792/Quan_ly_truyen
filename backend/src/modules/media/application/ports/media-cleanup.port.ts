import type { AuthPrincipal } from '@/common/interfaces/auth'; import type { CleanupSummary, MediaCleanupOptions } from '../dto';
export interface MediaCleanupPort { deleteById(mediaId:string,principal?:AuthPrincipal):Promise<void>; cleanupStaleMedia(options?:MediaCleanupOptions):Promise<CleanupSummary>; cleanupExpiredUploadIntents(options?:MediaCleanupOptions):Promise<CleanupSummary>; }
export const MEDIA_CLEANUP_PORT=Symbol('MEDIA_CLEANUP_PORT');
