import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';

import { requireEnvironmentVariable } from './environment';

export function createScriptPrismaClient(): PrismaClient {
  const connectionString = requireEnvironmentVariable('DATABASE_URL');

  const adapter = new PrismaPg({
    connectionString,
  });

  return new PrismaClient({
    adapter,
  });
}
