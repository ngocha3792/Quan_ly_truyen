import { Global, Module } from '@nestjs/common';

import { RequestContextStore } from './request-context.store';

@Global()
@Module({
  providers: [RequestContextStore],
  exports: [RequestContextStore],
})
export class RequestContextModule {}
