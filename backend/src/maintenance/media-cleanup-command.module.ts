import { Module } from '@nestjs/common';

import { AppConfigModule } from '@/config';
import { MediaModule } from '@/infrastructure/media';

@Module({ imports: [AppConfigModule, MediaModule] })
export class MediaCleanupCommandModule {}
