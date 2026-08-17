import type { AuthorProfileView, UpdateAuthorProfileInput } from '../dto';
export interface AuthorProfilePersistencePort {
  get(userId: string): Promise<AuthorProfileView>;
  update(input: UpdateAuthorProfileInput): Promise<AuthorProfileView>;
}
export const AUTHOR_PROFILE_PERSISTENCE_PORT = Symbol('AUTHOR_PROFILE_PERSISTENCE_PORT');
