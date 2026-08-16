import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, Observable } from 'rxjs';
import { getApiErrorMessage } from '../../../../../core/http/api-error.util';
import { AdminStoriesApiService } from '../../data-access/admin-stories-api.service';
import type { AdminStorySubmissionDetail } from '../../domain/admin-story.models';
import { AdminStoryStatusBadgeComponent } from '../../ui/admin-story-status-badge.component';

@Component({selector:'app-admin-story-submission-detail-page',standalone:true,imports:[DatePipe,FormsModule,RouterLink,AdminStoryStatusBadgeComponent],changeDetection:ChangeDetectionStrategy.OnPush,
templateUrl: './admin-story-submission-detail-page.component.html', styleUrl: './admin-story-submission-detail-page.component.scss'})
export class AdminStorySubmissionDetailPageComponent implements OnInit{
 private readonly api=inject(AdminStoriesApiService);private readonly route=inject(ActivatedRoute);private readonly destroyRef=inject(DestroyRef);private readonly id=this.route.snapshot.paramMap.get('submissionId')??'';readonly detail=signal<AdminStorySubmissionDetail|null>(null);readonly loading=signal(false);readonly mutating=signal(false);readonly error=signal('');readonly message=signal('');readonly rejectOpen=signal(false);rejectReason='';
 ngOnInit():void{this.load()} approve():void{if(!window.confirm('Duyệt submission này?'))return;this.run(this.api.approve(this.id),'Đã duyệt truyện.')} openReject():void{this.rejectReason='';this.rejectOpen.set(true)} closeReject():void{if(!this.mutating())this.rejectOpen.set(false)} confirmReject():void{const reason=this.rejectReason.trim();if(reason.length<10||reason.length>1000){this.error.set('Lý do phải từ 10 đến 1000 ký tự.');return}this.run(this.api.reject(this.id,reason),'Đã từ chối truyện.',true)}
 private run(request:Observable<unknown>,success:string,closeDialog=false):void{this.mutating.set(true);this.error.set('');this.message.set('');request.pipe(takeUntilDestroyed(this.destroyRef),finalize(()=>this.mutating.set(false))).subscribe({next:()=>{if(closeDialog)this.rejectOpen.set(false);this.message.set(success);this.load()},error:(e:unknown)=>this.error.set(getApiErrorMessage(e))})}
 private load():void{if(!this.id)return;this.loading.set(true);this.api.detail(this.id).pipe(takeUntilDestroyed(this.destroyRef),finalize(()=>this.loading.set(false))).subscribe({next:(data)=>this.detail.set(data),error:(e:unknown)=>this.error.set(getApiErrorMessage(e))})}
}
