import type { UserPreferencesEntity, UserProfileEntity } from '../../domain';

export const USER_PROFILE_READER_PORT = Symbol('USER_PROFILE_READER_PORT');

export interface UserProfileReaderPort {
  findProfileByUserId(userId: string): Promise<UserProfileEntity | null>;

  findPreferencesByUserId(
    userId: string,
  ): Promise<UserPreferencesEntity | null>;
}
