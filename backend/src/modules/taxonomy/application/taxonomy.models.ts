export interface TaxonomyAuditContext {
  readonly actorId?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly requestId?: string;
}

export interface AdminTagItem {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly storyCount: number;
  readonly createdAt: Date;
}

export interface AdminTagList {
  readonly items: readonly AdminTagItem[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalItems: number;
    readonly totalPages: number;
  };
}

export interface AdminCategoryItem {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly parentId: string | null;
  readonly parent: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
  } | null;
  readonly sortOrder: number;
  readonly isActive: boolean;
  readonly storyCount: number;
  readonly childCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AdminCategoryList {
  readonly items: readonly AdminCategoryItem[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalItems: number;
    readonly totalPages: number;
  };
}
