export interface AdminTag {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly storyCount: number;
  readonly createdAt: string;
}

export interface AdminTagList {
  readonly items: readonly AdminTag[];
  readonly pagination: {
    readonly page: number;
    readonly pageSize: number;
    readonly totalItems: number;
    readonly totalPages: number;
  };
}

export interface AdminTagMergeResult {
  readonly target: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly storyCount: number;
  };
  readonly merged: {
    readonly sourceTagId: string;
    readonly movedStoryCount: number;
    readonly deduplicatedStoryCount: number;
  };
}
