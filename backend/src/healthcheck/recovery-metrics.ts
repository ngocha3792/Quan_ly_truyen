import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';

interface BackupStatusFile {
  completedAt: string;
  offsiteVerified: boolean;
}

interface RestoreDrillStatusFile {
  completedAt: string;
}

interface RecoveryStatus {
  valid: boolean;
  timestampSeconds: number;
  ageSeconds: number;
}

const port = readPositiveNumber('RECOVERY_METRICS_PORT', 9464);

const backupStatusFile =
  process.env.RECOVERY_BACKUP_STATUS_FILE ??
  '/backups/backup-last-success.json';

const restoreDrillStatusFile =
  process.env.RECOVERY_RESTORE_DRILL_STATUS_FILE ??
  '/backups/restore-drill/restore-drill-last-success.json';

const backupRpoHours = readPositiveNumber('BACKUP_RPO_HOURS', 26);

const restoreDrillMaxAgeDays = readPositiveNumber(
  'RESTORE_DRILL_MAX_AGE_DAYS',
  8,
);

const offsiteBackupRequired =
  (process.env.OFFSITE_BACKUP_ENABLED ?? 'false').toLowerCase() === 'true';

const server: Server = createServer((request, response) => {
  void (async () => {
    if (request.url === '/health') {
      response.writeHead(200, {
        'content-type': 'text/plain; charset=utf-8',
      });
      response.end('ok\n');
      return;
    }

    if (request.url !== '/metrics') {
      response.writeHead(404, {
        'content-type': 'text/plain; charset=utf-8',
      });
      response.end('not found\n');
      return;
    }

    const nowSeconds = Date.now() / 1000;

    const backup = await readStatus<BackupStatusFile>(
      backupStatusFile,
      nowSeconds,
    );

    const restoreDrill = await readStatus<RestoreDrillStatusFile>(
      restoreDrillStatusFile,
      nowSeconds,
    );

    const backupFile = backup.value;

    const offsiteVerified =
      backup.valid && backupFile?.offsiteVerified === true ? 1 : 0;

    const metrics = [
      '# HELP qlt_recovery_status_file_valid Whether the recovery status file is readable and valid.',
      '# TYPE qlt_recovery_status_file_valid gauge',
      `qlt_recovery_status_file_valid{kind="backup"} ${backup.valid ? 1 : 0}`,
      `qlt_recovery_status_file_valid{kind="restore_drill"} ${restoreDrill.valid ? 1 : 0}`,
      '# HELP qlt_backup_last_success_timestamp_seconds Unix timestamp of the last successful PostgreSQL backup.',
      '# TYPE qlt_backup_last_success_timestamp_seconds gauge',
      `qlt_backup_last_success_timestamp_seconds ${backup.timestampSeconds}`,
      '# HELP qlt_backup_age_seconds Age of the last successful PostgreSQL backup.',
      '# TYPE qlt_backup_age_seconds gauge',
      `qlt_backup_age_seconds ${backup.ageSeconds}`,
      '# HELP qlt_backup_within_rpo Whether the most recent backup satisfies the configured RPO.',
      '# TYPE qlt_backup_within_rpo gauge',
      `qlt_backup_within_rpo ${
        backup.valid && backup.ageSeconds <= backupRpoHours * 3600 ? 1 : 0
      }`,
      '# HELP qlt_backup_offsite_required Whether encrypted off-site backup is required.',
      '# TYPE qlt_backup_offsite_required gauge',
      `qlt_backup_offsite_required ${offsiteBackupRequired ? 1 : 0}`,
      '# HELP qlt_backup_offsite_verified Whether the latest backup completed encrypted off-site verification.',
      '# TYPE qlt_backup_offsite_verified gauge',
      `qlt_backup_offsite_verified ${offsiteVerified}`,
      '# HELP qlt_restore_drill_last_success_timestamp_seconds Unix timestamp of the last successful restore drill.',
      '# TYPE qlt_restore_drill_last_success_timestamp_seconds gauge',
      `qlt_restore_drill_last_success_timestamp_seconds ${restoreDrill.timestampSeconds}`,
      '# HELP qlt_restore_drill_age_seconds Age of the last successful restore drill.',
      '# TYPE qlt_restore_drill_age_seconds gauge',
      `qlt_restore_drill_age_seconds ${restoreDrill.ageSeconds}`,
      '# HELP qlt_restore_drill_within_objective Whether the last restore drill is recent enough.',
      '# TYPE qlt_restore_drill_within_objective gauge',
      `qlt_restore_drill_within_objective ${
        restoreDrill.valid &&
        restoreDrill.ageSeconds <= restoreDrillMaxAgeDays * 86_400
          ? 1
          : 0
      }`,
      '',
    ].join('\n');

    response.writeHead(200, {
      'content-type': 'text/plain; version=0.0.4; charset=utf-8',
      'cache-control': 'no-store',
    });
    response.end(metrics);
  })();
});

server.listen(port, '0.0.0.0', () => {
  process.stdout.write(
    `${JSON.stringify({
      event: 'recovery.metrics.started',
      port,
    })}\n`,
  );
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}

async function readStatus<T>(
  path: string,
  nowSeconds: number,
): Promise<RecoveryStatus & { value?: T }> {
  try {
    const raw = await readFile(path, 'utf8');
    const value = JSON.parse(raw.replace(/^\uFEFF/u, '')) as T & {
      completedAt?: unknown;
    };

    if (typeof value.completedAt !== 'string') {
      return invalidStatus();
    }

    const timestampMs = Date.parse(value.completedAt);

    if (!Number.isFinite(timestampMs)) {
      return invalidStatus();
    }

    const timestampSeconds = timestampMs / 1000;

    return {
      valid: true,
      timestampSeconds,
      ageSeconds: Math.max(0, nowSeconds - timestampSeconds),
      value,
    };
  } catch {
    return invalidStatus();
  }
}

function invalidStatus(): RecoveryStatus {
  return {
    valid: false,
    timestampSeconds: 0,
    ageSeconds: 0,
  };
}

function readPositiveNumber(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }

  return value;
}
