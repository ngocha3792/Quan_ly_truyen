import type { CreateMediaUploadIntentInput, MediaAssetDto, ConfirmMediaUploadInput } from '../dto'; import type { SignedUploadParameters } from './signed-upload.interface'; import type { AuthPrincipal } from '@/common/interfaces/auth';
export interface MediaCommandPort { createUploadIntent(input:CreateMediaUploadIntentInput):Promise<SignedUploadParameters>; confirmUpload(input:{principal:AuthPrincipal;mediaAssetId:string;dto:ConfirmMediaUploadInput}):Promise<MediaAssetDto>; }
export const MEDIA_COMMAND_PORT=Symbol('MEDIA_COMMAND_PORT');
