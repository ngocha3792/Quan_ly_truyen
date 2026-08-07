import { Injectable } from '@angular/core';
import { delay, Observable, of } from 'rxjs';
import { CurrentUser } from '../../../../../core/auth/auth.models';
import {
  ProfileCompletion,
  UpdateAccountProfileRequest,
  UpdateAccountProfileResponse,
} from '../domain/account-profile.models';
import { MOCK_PROFILE_COMPLETION } from '../mock/account-profile.mock';
import { AccountProfileRepository } from './account-profile.repository';

@Injectable()
export class AccountProfileMockRepository implements AccountProfileRepository {
  updateProfile(payload: UpdateAccountProfileRequest): Observable<UpdateAccountProfileResponse> {
    const mockUser: CurrentUser = {
      id: 'mock-user-1',
      email: 'demouser@truyenhub.vn',
      username: 'demouser',
      displayName: payload.displayName,
      bio: payload.bio,
      emailVerified: true,
      roles: ['user'],
      sessionId: 'mock-session-123',
      status: 'active',
      emailVerifiedAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      avatar: payload.avatarMediaId
        ? {
            id: payload.avatarMediaId,
            url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          }
        : null,
      authorProfile: null,
      permissions: ['read:story'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return of(mockUser).pipe(delay(300));
  }

  getProfileCompletion(): Observable<ProfileCompletion> {
    return of(MOCK_PROFILE_COMPLETION).pipe(delay(200));
  }
}
