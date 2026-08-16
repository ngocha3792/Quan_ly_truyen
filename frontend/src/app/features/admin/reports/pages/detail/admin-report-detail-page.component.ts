import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, Observable } from 'rxjs';
import { AuthStore } from '../../../../../core/auth/auth.store';
import { AUTH_PERMISSIONS, type AuthPermission } from '../../../../../core/auth/authorization.models';
import { getApiErrorMessage } from '../../../../../core/http/api-error.util';
import { AdminReportsApiService } from '../../data-access/admin-reports-api.service';
import type { AdminReportDetail } from '../../domain/admin-report.models';

@Component({ selector:'app-admin-report-detail-page', standalone:true, imports:[FormsModule,RouterLink,DatePipe], templateUrl:'./admin-report-detail-page.component.html', styleUrl:'./admin-report-detail-page.component.scss', changeDetection:ChangeDetectionStrategy.OnPush })
export class AdminReportDetailPageComponent implements OnInit {
  private readonly api=inject(AdminReportsApiService); private readonly route=inject(ActivatedRoute); private readonly destroyRef=inject(DestroyRef); private readonly auth=inject(AuthStore);
  private readonly reportId=this.route.snapshot.paramMap.get('reportId')??'';
  readonly detail=signal<AdminReportDetail|null>(null); readonly loading=signal(false); readonly mutating=signal(false); readonly error=signal(''); readonly message=signal('');
  readonly canModerate=computed(()=>this.has(AUTH_PERMISSIONS.COMMENT_MODERATE)&&this.has(AUTH_PERMISSIONS.MODERATION_EXECUTE));
  readonly canWarn=computed(()=>this.has(AUTH_PERMISSIONS.MODERATION_EXECUTE));
  readonly canBan=computed(()=>this.has(AUTH_PERMISSIONS.MODERATION_EXECUTE)&&this.has(AUTH_PERMISSIONS.USER_MANAGE));
  reason=''; warningMessage=''; decisionNote='';
  readonly evidenceText=computed(()=>{const value=this.detail()?.evidence;return value?JSON.stringify(value,null,2):'Không có evidence.'});
  readonly evidenceBody=computed(()=>{const value=this.detail()?.evidence;if(!value||typeof value!=='object')return'';const comment=(value as {comment?:{body?:unknown}}).comment;return typeof comment?.body==='string'?comment.body:''});
  readonly editedAfterReport=computed(()=>{const d=this.detail();if(!d?.currentComment?.editedAt)return false;return Date.parse(d.currentComment.editedAt)>Date.parse(d.createdAt)});
  ngOnInit():void{this.load()}
  moderate(operation:'hold'|'hide'|'restore'|'remove'):void{const d=this.detail(),reason=this.reason.trim();if(!d?.currentComment||reason.length<10)return;this.run(this.api.moderate(d.currentComment.id,operation,reason,d.id),`Đã ${operation} comment.`)}
  warn():void{const d=this.detail(),reason=this.reason.trim(),message=this.warningMessage.trim();if(!d?.currentComment||reason.length<10||message.length<10)return;this.run(this.api.warn(d.currentComment.id,reason,message,d.id),'Đã gửi cảnh báo bắt buộc.')}
  ban():void{const d=this.detail(),reason=this.reason.trim();if(!d?.currentComment||reason.length<10)return;if(!window.confirm(`Ban user ${d.reportedUser?.displayName??''}? Active sessions sẽ bị revoke; nội dung cũ không tự xóa.`))return;this.run(this.api.ban(d.currentComment.id,reason,d.id),'Đã ban user và invalidate quyền truy cập.')}
  closeReport(kind:'resolve'|'reject'):void{const note=this.decisionNote.trim();if(note.length<10)return;this.run(kind==='resolve'?this.api.resolve(this.reportId,note):this.api.reject(this.reportId,note),kind==='resolve'?'Đã resolve report.':'Đã reject report.')}
  private run(request:Observable<unknown>,message:string):void{if(this.mutating())return;this.mutating.set(true);this.error.set('');request.pipe(takeUntilDestroyed(this.destroyRef),finalize(()=>this.mutating.set(false))).subscribe({next:()=>{this.message.set(message);this.load()},error:(e:unknown)=>this.error.set(getApiErrorMessage(e))})}
  private load():void{if(!this.reportId)return;this.loading.set(true);this.api.detail(this.reportId).pipe(takeUntilDestroyed(this.destroyRef),finalize(()=>this.loading.set(false))).subscribe({next:d=>this.detail.set(d),error:(e:unknown)=>this.error.set(getApiErrorMessage(e))})}
  private has(permission:AuthPermission):boolean{return this.auth.user()?.permissions.some(p=>p.toLowerCase()===permission)??false}
}
