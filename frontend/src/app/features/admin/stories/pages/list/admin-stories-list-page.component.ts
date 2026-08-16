import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, Subject } from 'rxjs';
import { getApiErrorMessage } from '../../../../../core/http/api-error.util';
import { AdminStoriesApiService } from '../../data-access/admin-stories-api.service';
import type { AdminStorySubmissionListResponse, AdminSubmissionStatus } from '../../domain/admin-story.models';
import { AdminStoryStatusBadgeComponent } from '../../ui/admin-story-status-badge.component';

@Component({ selector:'app-admin-stories-list-page',standalone:true,imports:[DatePipe,FormsModule,RouterLink,AdminStoryStatusBadgeComponent],changeDetection:ChangeDetectionStrategy.OnPush,
templateUrl: './admin-stories-list-page.component.html', styleUrl: './admin-stories-list-page.component.scss'})
export class AdminStoriesListPageComponent implements OnInit{
 private readonly api=inject(AdminStoriesApiService);private readonly route=inject(ActivatedRoute);private readonly router=inject(Router);private readonly destroyRef=inject(DestroyRef);readonly searchChanged=new Subject<void>();readonly loading=signal(false);readonly error=signal('');readonly result=signal<AdminStorySubmissionListResponse|null>(null);status:''|AdminSubmissionStatus='';author='';story='';reviewer='';submittedFrom='';submittedTo='';page=1;readonly pageSize=20;
 ngOnInit():void{this.searchChanged.pipe(debounceTime(300),takeUntilDestroyed(this.destroyRef)).subscribe(()=>this.applyFilters());this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((q)=>{this.status=(q.get('status') as AdminSubmissionStatus|null)??'';this.author=q.get('author')??'';this.story=q.get('story')??'';this.reviewer=q.get('reviewer')??'';this.submittedFrom=q.get('submittedFrom')??'';this.submittedTo=q.get('submittedTo')??'';this.page=Math.max(1,Number(q.get('page')??1)||1);this.load();});}
 applyFilters():void{this.navigate(1)} goPage(page:number):void{this.navigate(Math.max(1,page))}
 private navigate(page:number):void{void this.router.navigate([],{relativeTo:this.route,queryParams:{status:this.status||null,author:this.author.trim()||null,story:this.story.trim()||null,reviewer:this.reviewer.trim()||null,submittedFrom:this.submittedFrom||null,submittedTo:this.submittedTo||null,page}})}
 private load():void{this.loading.set(true);this.error.set('');this.api.list({status:this.status||undefined,author:this.author||undefined,story:this.story||undefined,reviewer:this.reviewer||undefined,submittedFrom:this.submittedFrom||undefined,submittedTo:this.submittedTo||undefined,page:this.page,pageSize:this.pageSize}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:(data)=>{this.result.set(data);this.loading.set(false)},error:(e:unknown)=>{this.error.set(getApiErrorMessage(e));this.loading.set(false)}})}
}
