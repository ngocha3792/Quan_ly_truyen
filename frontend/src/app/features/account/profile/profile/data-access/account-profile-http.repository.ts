import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import {
  AccountProfile,
  ProfileCompletion,
  UpdateAccountProfileRequest,
  UpdateAccountProfileResponse,
} from '../domain/account-profile.models';
import { AccountProfileApiService } from './account-profile-api.service';
import { AccountProfileRepository } from './account-profile.repository';

@Injectable()
export class AccountProfileHttpRepository implements AccountProfileRepository {
  private readonly api = inject(AccountProfileApiService);

  updateProfile(payload: UpdateAccountProfileRequest): Observable<UpdateAccountProfileResponse> {
    return this.api.updateProfile(payload);
  }

  getProfileCompletion(): Observable<ProfileCompletion> {
    return this.api.getProfile().pipe(
      map(profile => calculateProfileCompletion(profile)),
    );
  }
}

export function calculateProfileCompletion(profile: AccountProfile | null): ProfileCompletion {
  const items = [
    {
      label: 'Ảnh đại diện',
      description: profile?.avatar?.url ? 'Đã cập nhật' : 'Chưa cập nhật',
      completed: Boolean(profile?.avatar?.url),
    },
    {
      label: 'Email',
      description: profile?.emailVerified ? 'Đã xác minh' : 'Chưa xác minh',
      completed: Boolean(profile?.emailVerified),
    },
    {
      label: 'Tên hiển thị',
      description: profile?.displayName?.trim() ? 'Đã hoàn thành' : 'Chưa hoàn thành',
      completed: Boolean(profile?.displayName?.trim()),
    },
    {
      label: 'Tiểu sử',
      description: profile?.bio?.trim() ? 'Đã hoàn thành' : 'Chưa hoàn thành',
      completed: Boolean(profile?.bio?.trim()),
    },
  ];

  const completedCount = items.filter(item => item.completed).length;
  const percent = Math.round((completedCount / items.length) * 100);

  return {
    percent,
    items,
    message:
      percent === 100
        ? 'Hồ sơ của bạn đã hoàn thiện.'
        : percent >= 75
          ? 'Hồ sơ của bạn rất đầy đủ!'
          : 'Hãy bổ sung thêm thông tin hồ sơ.',
  };
}

