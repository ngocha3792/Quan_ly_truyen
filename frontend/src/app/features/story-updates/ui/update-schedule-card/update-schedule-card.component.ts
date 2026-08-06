import {
    ChangeDetectionStrategy,
    Component,
    input,
} from '@angular/core';

import { RouterLink } from '@angular/router';

import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { CompactNumberPipe } from '../../../../shared/pipes/compact-number.pipe';

import { StoryUpdateScheduleItem } from '../../domain/story-updates.models';

@Component({
    selector: 'app-update-schedule-card',
    standalone: true,
    imports: [
        RouterLink,
        IconComponent,
        CompactNumberPipe,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <section class="side-card">
      <header>
        <h2>Lịch cập nhật</h2>
        <a routerLink="/cap-nhat">Xem lịch đầy đủ</a>
      </header>

      <div class="schedule-list">
        @for (item of items(); track item.id) {
          <div class="schedule-row">
            <app-icon
              [name]="
                item.id === 'today'
                  ? 'calendar'
                  : item.id === 'tomorrow'
                    ? 'calendar-days'
                    : 'clock'
              "
              [size]="16"
            />

            <span>{{ item.label }}</span>

            <strong>
              {{ item.chapterCount | compactNumber }} chương
            </strong>
          </div>
        }
      </div>
    </section>
  `,
    styles: `
    .side-card {
      padding: 1.25rem;
      border: 1px solid var(--border, rgba(132, 145, 177, .16));
      border-radius: 12px;
      background: linear-gradient(
        145deg,
        rgba(17, 25, 44, .98),
        rgba(10, 16, 31, .98)
      );
    }

    header {
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    h2 {
      margin: 0;
      color: #ece9f0;
      font-size: 1.1rem;
      font-weight: 700;
    }

    header a {
      color: #a76cea;
      font-size: .85rem;
      text-decoration: none;
    }

    .schedule-list {
      display: grid;
      gap: 10px;
    }

    .schedule-row {
      display: grid;
      grid-template-columns: 20px minmax(0, 1fr) auto;
      align-items: center;
      gap: 8px;
      color: #7e88a0;
    }

    .schedule-row:nth-child(1) { color: #5caaff; }
    .schedule-row:nth-child(2) { color: #b46ff3; }
    .schedule-row:nth-child(3) { color: #e367db; }

    .schedule-row span {
      color: #919aad;
      font-size: .9rem;
    }

    .schedule-row strong {
      color: #afb6c3;
      font-size: .85rem;
      font-weight: 600;
    }
  `,
})
export class UpdateScheduleCardComponent {
    readonly items = input.required<readonly StoryUpdateScheduleItem[]>();
}