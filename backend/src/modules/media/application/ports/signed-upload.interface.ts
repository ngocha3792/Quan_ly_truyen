export interface SignedUploadParameters {
  mediaAssetId: string;
  uploadUrl: string;

  cloudName: string;
  apiKey: string;
  signature: string;
  timestamp: number;

  resourceType: 'image' | 'video' | 'raw';
  confirmExpiresAt: string;

  parameters: {
    upload_preset: string;
    public_id: string;
    asset_folder: string;
    overwrite: boolean;
    tags: string;
    eager?: string;
    eager_async?: boolean;
    eager_notification_url?: string;
    type?: 'authenticated';
  };
}
