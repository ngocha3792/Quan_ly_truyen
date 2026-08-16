import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

interface ComposeConfig {
  name?: string;
  networks?: Record<string, { name?: string; external?: boolean }>;
  services?: Record<
    string,
    {
      ports?: Array<
        | string
        | {
            mode?: string;
            target?: number;
            published?: string | number;
            protocol?: string;
            host_ip?: string;
          }
      >;
      environment?: Record<string, string | number | boolean>;
      networks?: Record<string, unknown> | string[];
    }
  >;
  volumes?: Record<string, { name?: string }>;
}

const BACKEND_ROOT = resolve(__dirname, '../..');
const OPS_PROD_DIR = join(BACKEND_ROOT, 'ops/production');

function getEnvValue(envFilePath: string, key: string): string | undefined {
  const content = readFileSync(join(BACKEND_ROOT, envFilePath), 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith(`${key}=`)) {
      let val = trimmed.slice(key.length + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      return val;
    }
  }
  return undefined;
}

function renderComposeConfig(
  envFile: string,
  composeFiles: string[],
  projectName?: string,
): ComposeConfig {
  const args = ['compose', '--env-file', envFile];

  if (projectName) {
    args.push('--project-name', projectName);
  }

  args.push(
    ...composeFiles.flatMap((file) => ['-f', file]),
    'config',
    '--format',
    'json',
  );

  try {
    const stdout = execFileSync('docker', args, {
      cwd: BACKEND_ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return JSON.parse(stdout) as ComposeConfig;
  } catch (error) {
    console.error(
      `Failed to render docker compose config with args: ${args.join(' ')}`,
    );
    throw error;
  }
}

function extractHostPorts(config: ComposeConfig): Set<number> {
  const ports = new Set<number>();
  if (!config.services) return ports;

  for (const service of Object.values(config.services)) {
    if (!service.ports) continue;
    for (const portEntry of service.ports) {
      if (typeof portEntry === 'string') {
        // e.g. "127.0.0.1:9093:9093/tcp" or "9093:9093"
        const parts = portEntry.split(':');
        if (parts.length >= 2) {
          const hostPortStr = parts.length === 3 ? parts[1] : parts[0];
          const parsed = parseInt(hostPortStr, 10);
          if (!Number.isNaN(parsed)) {
            ports.add(parsed);
          }
        }
      } else if (
        portEntry &&
        typeof portEntry === 'object' &&
        portEntry.published
      ) {
        const parsed = parseInt(String(portEntry.published), 10);
        if (!Number.isNaN(parsed)) {
          ports.add(parsed);
        }
      }
    }
  }

  return ports;
}

function extractBackendNetworkName(config: ComposeConfig): string | undefined {
  if (!config.networks) return undefined;
  const backendNet = config.networks['backend'];
  return backendNet?.name;
}

function validateScriptStaticIsolation(): void {
  console.info('Validating ops script environment-awareness...');

  const scriptsExpectingDynamicEnv = [
    'Deploy-Production.ps1',
    'Backup-Postgres.ps1',
    'Test-PostgresBackupArtifact.ps1',
    'Test-PostgresRestoreDrill.ps1',
    'Test-RecoveryReadiness.ps1',
    'Invoke-Maintenance.ps1',
    'Restore-Postgres.ps1',
  ];

  for (const scriptName of scriptsExpectingDynamicEnv) {
    const fullPath = join(OPS_PROD_DIR, scriptName);
    const content = readFileSync(fullPath, 'utf-8');

    // Check that param has EnvironmentFile
    if (!content.includes('$EnvironmentFile')) {
      throw new Error(
        `Script ${scriptName} is missing $EnvironmentFile parameter.`,
      );
    }

    // Check for raw hardcoded docker compose calls that use literal '.env.production' instead of $EnvironmentFilePath
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (
        line.includes('--env-file') &&
        line.includes('.env.production') &&
        !line.trim().startsWith('#')
      ) {
        throw new Error(
          `Script ${scriptName} line ${i + 1} contains hardcoded '--env-file .env.production': "${line.trim()}". It must use $EnvironmentFilePath.`,
        );
      }
    }
  }

  console.info(
    '  ✓ All ops scripts support dynamic $EnvironmentFile parameter and propagate it.',
  );
}

function main(): void {
  console.info('Starting Phase 0 Deployment Isolation Validation...\n');

  // 1. Static checks on ops scripts
  validateScriptStaticIsolation();

  // 2. Render configurations
  console.info(
    '\nRendering Docker Compose configurations for production and staging...',
  );

  const prodAppConfig = renderComposeConfig(
    'ops/production/compose.validation.env.example',
    ['compose.production.yml'],
  );
  const stagingAppConfig = renderComposeConfig(
    'ops/production/compose.validation.staging.env.example',
    ['compose.production.yml'],
  );

  const prodObsProject = getEnvValue(
    'ops/production/compose.validation.env.example',
    'OBSERVABILITY_COMPOSE_PROJECT_NAME',
  );
  const stagingObsProject = getEnvValue(
    'ops/production/compose.validation.staging.env.example',
    'OBSERVABILITY_COMPOSE_PROJECT_NAME',
  );

  const prodObsConfig = renderComposeConfig(
    'ops/production/compose.validation.env.example',
    ['ops/observability/docker-compose.observability.yml'],
    prodObsProject,
  );
  const stagingObsConfig = renderComposeConfig(
    'ops/production/compose.validation.staging.env.example',
    ['ops/observability/docker-compose.observability.yml'],
    stagingObsProject,
  );

  console.info('  ✓ Successfully rendered all 4 compose configurations.');

  // 3. Project Name Invariants
  console.info('\nVerifying Project Name Isolation...');
  console.info(`  Production App Project: ${prodAppConfig.name}`);
  console.info(`  Staging App Project: ${stagingAppConfig.name}`);
  if (prodAppConfig.name === stagingAppConfig.name) {
    throw new Error(
      'Production and Staging app Compose projects must not be equal!',
    );
  }

  console.info(`  Production Observability Project: ${prodObsConfig.name}`);
  console.info(`  Staging Observability Project: ${stagingObsConfig.name}`);
  if (prodObsConfig.name === stagingObsConfig.name) {
    throw new Error(
      'Production and Staging observability Compose projects must not be equal!',
    );
  }
  console.info(
    '  ✓ Project names are distinct between production and staging.',
  );

  // 4. Network Invariants
  console.info('\nVerifying Network Isolation...');
  const prodAppBackendNet = extractBackendNetworkName(prodAppConfig);
  const stagingAppBackendNet = extractBackendNetworkName(stagingAppConfig);
  const prodObsBackendNet = extractBackendNetworkName(prodObsConfig);
  const stagingObsBackendNet = extractBackendNetworkName(stagingObsConfig);

  console.info(`  Production App Backend Network: ${prodAppBackendNet}`);
  console.info(`  Staging App Backend Network: ${stagingAppBackendNet}`);
  console.info(
    `  Production Observability Backend Network: ${prodObsBackendNet}`,
  );
  console.info(
    `  Staging Observability Backend Network: ${stagingObsBackendNet}`,
  );

  if (
    !prodAppBackendNet ||
    !stagingAppBackendNet ||
    !prodObsBackendNet ||
    !stagingObsBackendNet
  ) {
    throw new Error(
      'One or more configurations are missing backend network definitions!',
    );
  }

  if (prodAppBackendNet === stagingAppBackendNet) {
    throw new Error(
      'Production and Staging app backend networks must not be equal!',
    );
  }

  if (prodObsBackendNet !== prodAppBackendNet) {
    throw new Error(
      `Production observability backend network (${prodObsBackendNet}) does not match production app backend network (${prodAppBackendNet})!`,
    );
  }

  if (stagingObsBackendNet !== stagingAppBackendNet) {
    throw new Error(
      `Staging observability backend network (${stagingObsBackendNet}) does not match staging app backend network (${stagingAppBackendNet})!`,
    );
  }

  const stagingObsRaw = JSON.stringify(stagingObsConfig);
  if (stagingObsRaw.includes('quan-ly-truyen-production-backend')) {
    throw new Error(
      'Staging observability configuration contains production backend network name!',
    );
  }

  console.info(
    '  ✓ Network bindings are completely isolated and matched per environment.',
  );

  // 5. Host Port Invariants
  console.info('\nVerifying Observability Host Port Collisions...');
  const prodHostPorts = extractHostPorts(prodObsConfig);
  const stagingHostPorts = extractHostPorts(stagingObsConfig);

  console.info(
    `  Production Observability Ports: ${[...prodHostPorts].sort().join(', ')}`,
  );
  console.info(
    `  Staging Observability Ports: ${[...stagingHostPorts].sort().join(', ')}`,
  );

  const collidingPorts: number[] = [];
  for (const port of stagingHostPorts) {
    if (prodHostPorts.has(port)) {
      collidingPorts.push(port);
    }
  }

  if (collidingPorts.length > 0) {
    throw new Error(
      `Host port collisions detected between production and staging observability: ${collidingPorts.join(', ')}`,
    );
  }
  console.info(
    '  ✓ No host port collisions between production and staging observability.',
  );

  console.info('\n🎉 All Phase 0 Deployment Isolation Checks PASSED!');
}

try {
  main();
} catch (err: unknown) {
  console.error(
    '\n❌ Deployment isolation validation failed:',
    err instanceof Error ? err.message : err,
  );
  process.exit(1);
}
