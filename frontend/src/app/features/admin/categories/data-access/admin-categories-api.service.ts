import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import {
  AdminCategory,
  AdminCategoryInput,
  AdminCategoryList,
} from '../domain/admin-category.models';

@Injectable({ providedIn: 'root' })
export class AdminCategoriesApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_RUNTIME_CONFIG);
  private readonly url = `${this.config.apiBaseUrl}/admin/categories`;

  list(
    input: {
      q?: string;
      isActive?: boolean;
      parentId?: string;
      page?: number;
      pageSize?: number;
      sort?: string;
    } = {},
  ): Observable<AdminCategoryList> {
    let params = new HttpParams()
      .set('page', input.page ?? 1)
      .set('pageSize', input.pageSize ?? 20)
      .set('sort', input.sort ?? 'default');
    if (input.q) params = params.set('q', input.q);
    if (input.isActive !== undefined) params = params.set('isActive', String(input.isActive));
    if (input.parentId) params = params.set('parentId', input.parentId);
    return this.http
      .get<ApiSuccessEnvelope<AdminCategoryList>>(this.url, { params })
      .pipe(map((response) => response.data));
  }

  create(
    input: Required<Pick<AdminCategoryInput, 'name'>> & AdminCategoryInput,
  ): Observable<AdminCategory> {
    return this.http
      .post<ApiSuccessEnvelope<AdminCategory>>(this.url, input)
      .pipe(map((response) => response.data));
  }

  update(categoryId: string, input: AdminCategoryInput): Observable<AdminCategory> {
    return this.http
      .patch<ApiSuccessEnvelope<AdminCategory>>(`${this.url}/${categoryId}`, input)
      .pipe(map((response) => response.data));
  }

  delete(categoryId: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${categoryId}`);
  }
}
