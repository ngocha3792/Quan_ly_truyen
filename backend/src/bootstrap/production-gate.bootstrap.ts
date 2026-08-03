import { NestFactory } from '@nestjs/core';

import {
  ProductionGateModule,
  ProductionGateService,
} from '@/infrastructure/production-gate';

export async function runProductionBootstrapGate(
  role: 'api' | 'worker',
): Promise<void> {
  /*
   * Không khởi tạo context gate ở local/test.
   */
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const context = await NestFactory.createApplicationContext(
    ProductionGateModule,

    {
      logger: ['error', 'warn'],
    },
  );

  try {
    await context.get(ProductionGateService).assertBootstrapReady(role);
  } finally {
    await context.close();
  }
}
