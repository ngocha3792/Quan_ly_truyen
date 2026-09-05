import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthorStudioProfile } from '../../domain/author-studio.models';
import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import {
  ShellNavigationItem,
  ShellSidebarComponent,
} from '../../../../../shared/components/shell-sidebar/shell-sidebar.component';

@Component({
  selector: 'app-studio-sidebar',
  standalone: true,

  imports: [RouterLink, IconComponent, ShellSidebarComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './studio-sidebar.component.html',

  styleUrl: './studio-sidebar.component.scss',
})
export class StudioSidebarComponent {
  @Input({ required: true })
  profile!: AuthorStudioProfile;

  @Input()
  unreadNotifications = 0;

  @Output()
  readonly navigated = new EventEmitter<void>();

  protected readonly navigationItems: readonly ShellNavigationItem[] = [
    {
      label: 'Tổng quan',
      route: '/author-studio/tong-quan',
      icon: 'home',
      exact: true,
    },
    {
      label: 'Truyện của tôi',
      route: '/author-studio/truyen',
      icon: 'book',
    },
    {
      label: 'Hồ sơ tác giả',
      route: '/author-studio/ho-so',
      icon: 'user',
    },
    {
      label: 'Thống kê',
      route: '/author-studio/thong-ke',
      icon: 'chart',
    },
  ];
}
