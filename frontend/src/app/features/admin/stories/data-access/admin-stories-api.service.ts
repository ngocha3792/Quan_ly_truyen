import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { APP_RUNTIME_CONFIG } from '../../../../core/config/app-config.token';
import { ApiSuccessEnvelope } from '../../../../core/http/api-envelope.model';
import type { AdminStorySubmissionDetail, AdminStorySubmissionListResponse, AdminSubmissionStatus } from '../domain/admin-story.models';

@Injectable({ providedIn: 'root' })
export class AdminStoriesApiService {
  private readonly http=inject(HttpClient); private readonly config=inject(APP_RUNTIME_CONFIG); private readonly baseUrl=`${this.config.apiBaseUrl}/admin/story-submissions`;
  list(input:{status?:AdminSubmissionStatus;author?:string;story?:string;reviewer?:string;submittedFrom?:string;submittedTo?:string;page:number;pageSize:number}):Observable<AdminStorySubmissionListResponse>{
    let params=new HttpParams().set('page',String(input.page)).set('pageSize',String(input.pageSize)).set('sort','submittedAt:desc');
    if(input.status)params=params.set('status',input.status); if(input.author?.trim())params=params.set('author',input.author.trim()); if(input.story?.trim())params=params.set('story',input.story.trim()); if(input.reviewer?.trim())params=params.set('reviewer',input.reviewer.trim()); if(input.submittedFrom)params=params.set('submittedFrom',input.submittedFrom); if(input.submittedTo)params=params.set('submittedTo',input.submittedTo);
    return this.http.get<ApiSuccessEnvelope<AdminStorySubmissionListResponse>>(this.baseUrl,{params}).pipe(map((response)=>response.data));
  }
  detail(id:string):Observable<AdminStorySubmissionDetail>{ return this.http.get<ApiSuccessEnvelope<AdminStorySubmissionDetail>>(`${this.baseUrl}/${id}`).pipe(map((response)=>response.data)); }
  approve(id:string):Observable<unknown>{ return this.http.post(`${this.baseUrl}/${id}/approve`,{}, {headers:this.idempotencyHeaders()}); }
  reject(id:string,reason:string):Observable<unknown>{ return this.http.post(`${this.baseUrl}/${id}/reject`,{reviewerNote:reason.trim()},{headers:this.idempotencyHeaders()}); }
  private idempotencyHeaders():HttpHeaders{return new HttpHeaders({'x-idempotency-key':crypto.randomUUID()});}
}
