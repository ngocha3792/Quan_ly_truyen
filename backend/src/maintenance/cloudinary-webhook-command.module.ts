import { Module } from '@nestjs/common';

import { AppConfigModule } from '@/config';
import { MediaModule } from '@/modules/media';

@Module({ imports: [AppConfigModule, MediaModule] })
export class CloudinaryWebhookCommandModule {}
