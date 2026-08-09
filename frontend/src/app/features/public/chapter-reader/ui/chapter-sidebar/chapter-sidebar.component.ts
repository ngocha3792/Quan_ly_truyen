import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import { ChapterReaderView } from '../../domain/chapter-reader.models';

@Component({
  selector: 'app-chapter-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './chapter-sidebar.component.html',

  styleUrl: './chapter-sidebar.component.scss',
})
export class ChapterSidebarComponent {
  @Input({ required: true })
  data!: ChapterReaderView;

  @Input()
  fontSize = 18;

  @Input()
  lightsOff = false;

  @Input()
  bookmarked = false;

  @Output()
  readonly fontDecrease = new EventEmitter<void>();

  @Output()
  readonly fontIncrease = new EventEmitter<void>();

  @Output()
  readonly fontReset = new EventEmitter<void>();

  @Output()
  readonly lightsToggle = new EventEmitter<void>();

  @Output()
  readonly bookmarkToggle = new EventEmitter<void>();
}
