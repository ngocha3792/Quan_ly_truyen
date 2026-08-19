import type { AdminAuthorDetailDto, AdminAuthorListDto } from '../dto';
import type { AuthorLifecycleStatus } from '../../domain';
export interface AuthorLifecyclePersistencePort {
  assertActiveAuthor(userId: string): Promise<void>;
  list(input: {
    search?: string;
    status?: AuthorLifecycleStatus;
    createdFrom?: Date;
    createdTo?: Date;
    page: number;
    pageSize: number;
  }): Promise<AdminAuthorListDto>;
  detail(authorId: string): Promise<AdminAuthorDetailDto>;
  changeStatus(input: {
    actorUserId: string;
    authorId: string;
    status: AuthorLifecycleStatus;
    reason?: string;
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
  }): Promise<AdminAuthorDetailDto>;
}
export const AUTHOR_LIFECYCLE_PERSISTENCE_PORT = Symbol(
  'AUTHOR_LIFECYCLE_PERSISTENCE_PORT',
);
