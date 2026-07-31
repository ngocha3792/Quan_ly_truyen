import type { ModuleMetadata, Provider, Type } from '@nestjs/common';

import type { CommonMiddlewaresOptions } from './common-middlewares-options.interface';

export interface CommonMiddlewaresOptionsFactory {
  createCommonMiddlewaresOptions():
    CommonMiddlewaresOptions | Promise<CommonMiddlewaresOptions>;
}

export interface CommonMiddlewaresAsyncOptions extends Pick<
  ModuleMetadata,
  'imports'
> {
  inject?: readonly unknown[];
  useFactory?: (
    ...args: any[]
  ) => CommonMiddlewaresOptions | Promise<CommonMiddlewaresOptions>;
  useClass?: Type<CommonMiddlewaresOptionsFactory>;
  useExisting?: Type<CommonMiddlewaresOptionsFactory>;
  extraProviders?: Provider[];
}
