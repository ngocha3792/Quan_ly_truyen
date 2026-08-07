import { inject, Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  ProfileCompletion,
  UpdateAccountProfileRequest,
  UpdateAccountProfileResponse,
} from '../domain/account-profile.models';
import { MOCK_PROFILE_COMPLETION } from '../mock/account-profile.mock';
import { AccountProfileApiService } from './account-profile-api.service';
import { AccountProfileRepository } from './account-profile.repository';

@Injectable()
export class AccountProfileHttpRepository implements AccountProfileRepository {
  private readonly api = inject(AccountProfileApiService);

  updateProfile(payload: UpdateAccountProfileRequest): Observable<UpdateAccountProfileResponse> {
    return this.api.updateProfile(payload);
  }

  getProfileCompletion(): Observable<ProfileCompletion> {
    return of(MOCK_PROFILE_COMPLETION);
  }
}
