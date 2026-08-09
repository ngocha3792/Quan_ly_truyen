import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import { RouterLink } from '@angular/router';

import { AuthorApplicationRecord } from '../../domain/author-application.models';

@Component({
  selector: 'app-author-application-status',

  standalone: true,

  imports: [RouterLink],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './author-application-status.component.html',

  styleUrl: './author-application-status.component.scss',
})
export class AuthorApplicationStatusComponent {
  @Input({
    required: true,
  })
  application!: AuthorApplicationRecord;

  @Input()
  checking = false;

  @Output()
  refreshStatus = new EventEmitter<void>();

  protected formatDate(value: string): string {
    return new Date(value).toLocaleString('vi-VN');
  }
}
