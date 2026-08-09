import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { SearchFieldComponent } from '../../../../shared/components/search-field/search-field.component';
import {
  TabFilterComponent,
  TabFilterOption,
} from '../../../../shared/components/tab-filter/tab-filter.component';
import { AdminAuthorApplicationStatusFilter } from '../domain/admin-author-application.models';

@Component({
  selector: 'app-admin-author-application-filters',
  standalone: true,
  imports: [SearchFieldComponent, TabFilterComponent],
  templateUrl: './admin-author-application-filters.component.html',
  styleUrl: './admin-author-application-filters.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAuthorApplicationFiltersComponent {
  @Input() keyword = '';
  @Input() status: AdminAuthorApplicationStatusFilter = 'PENDING';
  @Input() total = 0;
  @Input({ required: true })
  statusOptions!: readonly TabFilterOption<AdminAuthorApplicationStatusFilter>[];
  @Output() readonly keywordChange = new EventEmitter<string>();
  @Output() readonly statusChange = new EventEmitter<AdminAuthorApplicationStatusFilter>();
  @Output() readonly searchRequested = new EventEmitter<void>();
  protected submit(event: Event): void {
    event.preventDefault();
    this.searchRequested.emit();
  }
}
