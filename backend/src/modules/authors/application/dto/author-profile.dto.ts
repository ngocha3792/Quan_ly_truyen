export interface AuthorProfileSocialLinks {
  readonly website: string | null;
  readonly facebook: string | null;
  readonly instagram: string | null;
  readonly x: string | null;
  readonly youtube: string | null;
  readonly tiktok: string | null;
}

export interface AuthorProfileView {
  readonly id: string;
  readonly displayName: string;
  readonly slug: string;
  readonly bio: string | null;
  readonly avatar: { readonly id: string; readonly url: string } | null;
  readonly banner: { readonly id: string; readonly url: string } | null;
  readonly socialLinks: AuthorProfileSocialLinks;
  readonly verified: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface UpdateAuthorProfileInput {
  readonly userId: string;
  readonly displayName?: string;
  readonly bio?: string | null;
  readonly avatarMediaId?: string | null;
  readonly bannerMediaId?: string | null;
  readonly socialLinks?: Partial<AuthorProfileSocialLinks>;
  readonly audit: {
    readonly ipAddress?: string;
    readonly userAgent?: string;
    readonly requestId?: string;
  };
}
