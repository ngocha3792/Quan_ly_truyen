import { ChangeDetectionStrategy, Component, effect, inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { ReadingGoalStore } from '../../data-access/reading-goal.store';

@Component({
  selector: 'app-reading-goal-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  providers: [ReadingGoalStore],
  templateUrl: './reading-goal-page.component.html',
  styleUrl: './reading-goal-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReadingGoalPageComponent implements OnInit {
  protected readonly store = inject(ReadingGoalStore);

  protected readonly form = new FormGroup({
    targetChapters: new FormControl(7, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(100)],
    }),
  });

  constructor() {
    effect(() => {
      const goal = this.store.goal();
      if (goal && goal.targetChapters > 0) {
        this.form.reset({ targetChapters: goal.targetChapters }, { emitEvent: false });
      }
    });
  }

  ngOnInit(): void {
    this.store.load();
  }

  protected getGoalProgress(): number {
    const goal = this.store.goal();
    if (!goal?.targetChapters) return 0;
    return Math.min(100, Math.round((goal.completedChapters / goal.targetChapters) * 100));
  }

  protected save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.store.saving()) return;

    this.store.save(this.form.getRawValue().targetChapters).subscribe();
  }
}
