import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { SearchFieldComponent } from '../../../../shared/components/search-field/search-field.component';
import {
  TabFilterComponent,
  TabFilterOption,
} from '../../../../shared/components/tab-filter/tab-filter.component';
import { ManagedUserRoleFilter, ManagedUserStatusFilter } from '../domain/admin-user.models';

@Component({
  selector: 'app-admin-users-filters',
  standalone: true,
  imports: [ButtonComponent, SearchFieldComponent, TabFilterComponent],
  templateUrl: './admin-users-filters.component.html',
  styleUrl: './admin-users-filters.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsersFiltersComponent {
  @Input() keyword = '';
  @Input() status: ManagedUserStatusFilter = 'ALL';
  @Input() role: ManagedUserRoleFilter = 'ALL';
  @Input({ required: true }) statusOptions!: readonly TabFilterOption<ManagedUserStatusFilter>[];

  @Output() readonly keywordChange = new EventEmitter<string>();
  @Output() readonly statusChange = new EventEmitter<ManagedUserStatusFilter>();
  @Output() readonly roleChange = new EventEmitter<ManagedUserRoleFilter>();
  @Output() readonly searchRequested = new EventEmitter<void>();

  protected submit(event: Event): void {
    event.preventDefault();
    this.searchRequested.emit();
  }

  protected changeRole(event: Event): void {
    this.roleChange.emit((event.target as HTMLSelectElement).value as ManagedUserRoleFilter);
  }
}
