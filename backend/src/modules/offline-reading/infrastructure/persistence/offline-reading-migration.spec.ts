import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('offline reading migration safety', () => {
  const sql = readFileSync(
    join(
      process.cwd(),
      'prisma',
      'migrations',
      '20260908130000_add_offline_reading_packages',
      'migration.sql',
    ),
    'utf8',
  );

  it('preserves immutable snapshots when source rows are removed', () => {
    expect(sql).toContain('REFERENCES "sessions"("id") ON DELETE SET NULL');
    expect(sql).not.toContain(
      'FOREIGN KEY ("chapter_id") REFERENCES "chapters"',
    );
    expect(sql).not.toContain(
      'FOREIGN KEY ("entitlement_id") REFERENCES "chapter_entitlements"',
    );
  });

  it('branches on trigger operation before reading NEW during deletes', () => {
    const sessionFunction = sql.slice(
      sql.indexOf(
        'CREATE OR REPLACE FUNCTION revoke_offline_packages_for_session',
      ),
      sql.indexOf('DROP TRIGGER IF EXISTS "sessions_revoke_offline_packages"'),
    );
    expect(sessionFunction.indexOf("IF TG_OP = 'DELETE'")).toBeLessThan(
      sessionFunction.indexOf('NEW."revoked_at"'),
    );

    const entitlementFunction = sql.slice(
      sql.indexOf(
        'CREATE OR REPLACE FUNCTION revoke_offline_packages_for_entitlement',
      ),
      sql.indexOf(
        'DROP TRIGGER IF EXISTS "entitlements_revoke_offline_packages"',
      ),
    );
    expect(entitlementFunction.indexOf("IF TG_OP = 'DELETE'")).toBeLessThan(
      entitlementFunction.indexOf('NEW."status"'),
    );
  });

  it('reconciles quota for every package lifecycle mutation', () => {
    expect(sql).toContain(
      'AFTER INSERT OR DELETE OR UPDATE OF "status", "total_size_bytes", "user_id"',
    );
    expect(sql).toContain('PERFORM reconcile_offline_quota_usage');
  });

  it('normalizes active offline media references and releases them with the package lifecycle', () => {
    expect(sql).toContain(
      'CREATE TABLE IF NOT EXISTS "offline_package_media_pins"',
    );
    expect(sql).toContain(
      'FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT',
    );
    expect(sql).toContain(
      'FOREIGN KEY ("package_id") REFERENCES "offline_packages"("id") ON DELETE CASCADE',
    );
    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION release_offline_media_pins_when_not_ready',
    );
    expect(sql).toContain(
      `IF OLD."status" = 'ready' AND NEW."status" <> 'ready'`,
    );
    expect(sql).toContain(
      'CREATE TRIGGER "offline_packages_release_media_pins"',
    );
  });
});
