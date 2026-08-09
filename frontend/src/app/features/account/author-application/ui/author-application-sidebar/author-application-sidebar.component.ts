import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import {
  AuthorBenefit,
  AuthorReviewRequirement,
  AuthorReviewStep,
} from '../../domain/author-application.models';

@Component({
  selector: 'app-author-application-sidebar',
  standalone: true,

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './author-application-sidebar.component.html',

  styleUrl: './author-application-sidebar.component.scss',
})
export class AuthorApplicationSidebarComponent {
  @Input({ required: true })
  requirements: readonly AuthorReviewRequirement[] = [];

  @Input({ required: true })
  reviewSteps: readonly AuthorReviewStep[] = [];

  @Input({ required: true })
  benefits: readonly AuthorBenefit[] = [];
}
