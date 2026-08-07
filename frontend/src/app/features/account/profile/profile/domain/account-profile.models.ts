import { CurrentUser } from '../../../../../core/auth/auth.models';

export interface UpdateAccountProfileRequest {
  readonly displayName: string;
  readonly bio: string | null;
  readonly avatarMediaId: string | null;
}

export type UpdateAccountProfileResponse = CurrentUser;

export interface AccountProfileFormValue {
  readonly displayName: string;
  readonly bio: string;
}

export interface AccountUiPreferences {
  readonly newChapterNotifications: boolean;
  readonly showRecentActivity: boolean;
  readonly allowUpdateEmails: boolean;
}

export interface ProfileCompletionItem {
  readonly label: string;
  readonly description: string;
  readonly completed: boolean;
}

export interface ProfileCompletion {
  readonly percent: number;
  readonly message: string;
  readonly items: readonly ProfileCompletionItem[];
}

export interface MediaUploadIntent {
  readonly mediaAssetId: string;
  readonly uploadUrl: string;

  readonly cloudName: string;
  readonly apiKey: string;
  readonly signature: string;
  readonly timestamp: number;

  readonly resourceType: 'image' | 'video' | 'raw';
  readonly confirmExpiresAt: string;

  readonly parameters: {
    readonly upload_preset: string;
    readonly public_id: string;
    readonly asset_folder: string;
    readonly overwrite: boolean;
    readonly tags: string;
  };
}

export interface CloudinaryUploadResponse {
  readonly public_id: string;
  readonly version: number;
  readonly signature: string;
  readonly resource_type: 'image' | 'video' | 'raw';
  readonly secure_url: string;
}

export interface ConfirmedMedia {
  readonly id: string;
  readonly purpose: string;
  readonly status: string;
  readonly resourceType: string | null;
  readonly deliveryUrl: string | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly sizeBytes: string | null;
}
