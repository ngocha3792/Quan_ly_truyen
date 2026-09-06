import { MODULE_METADATA } from '@nestjs/common/constants';

import { AiProtocolRegistry } from './infrastructure';
import { AiWorkerModule } from './ai-worker.module';

describe('AiWorkerModule', () => {
  it('registers every protocol adapter required by the registry', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      AiWorkerModule,
    ) as unknown[];
    const registryDependencies = Reflect.getMetadata(
      'design:paramtypes',
      AiProtocolRegistry,
    ) as Array<{ readonly name?: string }>;

    const protocolAdapters = registryDependencies.filter((dependency) =>
      dependency.name?.endsWith('ProtocolAdapter'),
    );

    expect(protocolAdapters).not.toHaveLength(0);
    expect(providers).toEqual(expect.arrayContaining(protocolAdapters));
  });
});
