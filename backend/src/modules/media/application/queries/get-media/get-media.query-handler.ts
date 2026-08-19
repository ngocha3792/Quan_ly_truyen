import { Inject, Injectable } from '@nestjs/common';
import type { MediaAssetDto } from '../../dto';
import { MEDIA_QUERY_PORT, type MediaQueryPort } from '../../ports';
import { GetMediaQuery } from './get-media.query';
@Injectable()
export class GetMediaQueryHandler {
  constructor(
    @Inject(MEDIA_QUERY_PORT) private readonly media: MediaQueryPort,
  ) {}
  execute(query: GetMediaQuery): Promise<MediaAssetDto> {
    return this.media.getAccessibleById(query.mediaId, query.principal);
  }
  deliveryUrl(media: MediaAssetDto): string | null {
    return this.media.getDeliveryUrl(media);
  }
}
