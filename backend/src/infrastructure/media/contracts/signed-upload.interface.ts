export interface SignedUploadParameters {
  mediaAssetId: string;
  uploadUrl: string;

  cloudName: string;
  apiKey: string;
  signature: string;
  timestamp: number;

  resourceType: 'image' | 'video' | 'raw';
  expiresAt: string;

  parameters: {
    upload_preset: string;
    public_id: string;
    asset_folder: string;
    overwrite: boolean;
    tags: string;
  };
}
