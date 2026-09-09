import { inject } from '@angular/core';
import { CanActivateFn, CanDeactivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthorStoryManagementRepository } from '../domain/author-story-management.repository';

/** Story membership is resolved by the backend; contributors need no author-role shortcut. */
export const chapterEditorAccessGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const storyId = route.paramMap.get('storyId');
  const chapterId = route.paramMap.get('chapterId');
  if (!storyId || !chapterId) return router.createUrlTree(['/']);
  return inject(AuthorStoryManagementRepository)
    .getChapter(storyId, chapterId)
    .pipe(
      map(() => true),
      catchError(() => of(router.createUrlTree(['/']))),
    );
};

export const chapterEditorLeaveGuard: CanDeactivateFn<{ canLeave(): Promise<boolean> }> = (
  component,
) => component.canLeave();
