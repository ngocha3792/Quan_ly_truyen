import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, finalize, Subject } from 'rxjs';
import { getApiErrorMessage } from '../../../../../core/http/api-error.util';
import { AdminReportsApiService } from '../../data-access/admin-reports-api.service';
import type { AdminReportList, AdminReportReason, AdminReportStatus } from '../../domain/admin-report.models';

@Component({ selector:'app-admin-reports-list-page', standalone:true, imports:[FormsModule,RouterLink,DatePipe], templateUrl:'./admin-reports-list-page.component.html', styleUrl:'./admin-reports-list-page.component.scss', changeDetection:ChangeDetectionStrategy.OnPush })
export class AdminReportsListPageComponent implements OnInit {
  private readonly api=inject(AdminReportsApiService); private readonly route=inject(ActivatedRoute); private readonly router=inject(Router); private readonly destroyRef=inject(DestroyRef);
  readonly result=signal<AdminReportList|null>(null); readonly loading=signal(false); readonly error=signal(''); readonly searchChanged=new Subject<void>();
  readonly statuses: readonly AdminReportStatus[]=['OPEN','IN_REVIEW','RESOLVED','REJECTED'];
  readonly reasons: readonly AdminReportReason[]=['SPAM','HARASSMENT','HATE_SPEECH','SEXUAL_CONTENT','VIOLENCE','COPYRIGHT','MISINFORMATION','OTHER'];
  status=''; reason=''; reporter=''; reportedUser=''; createdFrom=''; createdTo=''; page=1; readonly pageSize=20;
  ngOnInit():void{this.searchChanged.pipe(debounceTime(300),takeUntilDestroyed(this.destroyRef)).subscribe(()=>this.go(1));this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(p=>{this.status=p.get('status')??'';this.reason=p.get('reason')??'';this.reporter=p.get('reporter')??'';this.reportedUser=p.get('reportedUser')??'';this.createdFrom=p.get('createdFrom')??'';this.createdTo=p.get('createdTo')??'';this.page=Math.max(1,Number(p.get('page')??1)||1);this.load()})}
  go(page:number):void{void this.router.navigate([],{relativeTo:this.route,queryParams:{status:this.status||null,reason:this.reason||null,reporter:this.reporter.trim()||null,reportedUser:this.reportedUser.trim()||null,createdFrom:this.createdFrom||null,createdTo:this.createdTo||null,page}})}
  private load():void{this.loading.set(true);this.error.set('');this.api.list({status:this.status as AdminReportStatus||undefined,reason:this.reason as AdminReportReason||undefined,reporter:this.reporter.trim()||undefined,reportedUser:this.reportedUser.trim()||undefined,createdFrom:this.createdFrom||undefined,createdTo:this.createdTo||undefined,page:this.page,pageSize:this.pageSize}).pipe(takeUntilDestroyed(this.destroyRef),finalize(()=>this.loading.set(false))).subscribe({next:r=>this.result.set(r),error:(e:unknown)=>this.error.set(getApiErrorMessage(e))})}
}
