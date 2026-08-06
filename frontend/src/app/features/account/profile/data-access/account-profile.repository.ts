import { Observable } from 'rxjs';
import {
  ProfileCompletion,
  UpdateAccountProfileRequest,
  UpdateAccountProfileResponse,
} from '../domain/account-profile.models';

export abstract class AccountProfileRepository {
  abstract updateProfile(payload: UpdateAccountProfileRequest): Observable<UpdateAccountProfileResponse>;
  abstract getProfileCompletion(): Observable<ProfileCompletion>;
}
