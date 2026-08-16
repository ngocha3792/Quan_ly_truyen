export interface AdminCategory {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly parentId: string | null;
  readonly parent: { readonly id: string; readonly name: string; readonly slug: string } | null;
  readonly sortOrder: number;
  readonly isActive: boolean;
  readonly storyCount: number;
  readonly childCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AdminCategoryList {
  readonly items: readonly AdminCategory[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalItems: number;
    readonly totalPages: number;
  };
}

export interface AdminCategoryInput {
  readonly name?: string;
  readonly description?: string | null;
  readonly parentId?: string | null;
  readonly sortOrder?: number;
  readonly isActive?: boolean;
}
