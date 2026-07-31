ALTER TYPE media_status ADD VALUE IF NOT EXISTS 'uploaded';
ALTER TYPE media_status ADD VALUE IF NOT EXISTS 'processing';
ALTER TYPE media_status ADD VALUE IF NOT EXISTS 'deleting';
ALTER TYPE media_status ADD VALUE IF NOT EXISTS 'delete_failed';

DO $$
BEGIN
    CREATE TYPE media_resource_type AS ENUM ('image', 'video', 'raw');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE media_assets
    ALTER COLUMN bucket DROP NOT NULL,
    ALTER COLUMN storage_key DROP NOT NULL,
    ALTER COLUMN original_name DROP NOT NULL,
    ALTER COLUMN mime_type DROP NOT NULL,
    ALTER COLUMN size_bytes DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS provider_asset_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS public_id VARCHAR(512),
    ADD COLUMN IF NOT EXISTS version INTEGER,
    ADD COLUMN IF NOT EXISTS resource_type media_resource_type,
    ADD COLUMN IF NOT EXISTS delivery_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS format VARCHAR(30),
    ADD COLUMN IF NOT EXISTS asset_folder VARCHAR(1024),
    ADD COLUMN IF NOT EXISTS secure_url VARCHAR(2048),
    ADD COLUMN IF NOT EXISTS duration DECIMAL(12,3),
    ADD COLUMN IF NOT EXISTS upload_expires_at TIMESTAMPTZ(3),
    ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ(3),
    ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ(3);

CREATE UNIQUE INDEX IF NOT EXISTS media_assets_provider_asset_id_key ON media_assets(provider_asset_id);
CREATE UNIQUE INDEX IF NOT EXISTS media_assets_public_id_key ON media_assets(public_id);
CREATE INDEX IF NOT EXISTS media_assets_status_upload_expires_at_idx ON media_assets(status, upload_expires_at);
CREATE INDEX IF NOT EXISTS media_assets_storage_provider_provider_asset_id_idx ON media_assets(storage_provider, provider_asset_id);
