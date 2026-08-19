import type { AuthPrincipal } from '@/common/interfaces/auth';
import type { MediaAssetDto } from '../dto';
export interface MediaQueryPort {
  findById(id: string): Promise<MediaAssetDto | null>;
  getAccessibleById(
    id: string,
    principal: AuthPrincipal,
  ): Promise<MediaAssetDto>;
  getDeliveryUrl(media: MediaAssetDto): string | null;
}
export const MEDIA_QUERY_PORT = Symbol('MEDIA_QUERY_PORT');
