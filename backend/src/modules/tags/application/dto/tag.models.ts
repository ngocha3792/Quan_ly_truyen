export interface TagAuditContext {
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

export interface ListTagsInput {
  readonly q?: string;
  readonly page: number;
  readonly pageSize: number;
  readonly sort: string;
}
