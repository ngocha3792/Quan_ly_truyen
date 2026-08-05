import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-search-box',
  standalone: true,
  templateUrl: './search-box.component.html',
  styleUrls: ['./search-box.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchBoxComponent {
  @Input() placeholder = 'Tìm kiếm...';
  @Input() ariaLabel = 'Tìm kiếm';
  @Output() readonly queryChange = new EventEmitter<string>();

  onInput(event: Event): void {
    this.queryChange.emit((event.target as HTMLInputElement).value);
  }
}
