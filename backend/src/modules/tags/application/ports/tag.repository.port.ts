import type {
  AdminTagItem,
  AdminTagList,
  ListTagsInput,
  TagAuditContext,
} from '../dto';

export const TAG_REPOSITORY = Symbol.for('modules.tags.repository');

export interface TagRepositoryPort {
  list(input: ListTagsInput): Promise<AdminTagList>;
  create(name: string, audit: TagAuditContext): Promise<AdminTagItem>;
  update(
    id: string,
    name: string,
    audit: TagAuditContext,
  ): Promise<AdminTagItem>;
  delete(id: string, audit: TagAuditContext): Promise<void>;
  merge(
    sourceTagId: string,
    targetTagId: string,
    audit: TagAuditContext,
  ): Promise<{
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
  }>;
}
