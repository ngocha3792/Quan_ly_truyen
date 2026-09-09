import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import {
  AuthorChapterMonetization,
  AuthorChapterPricingInput,
  MonetizationPriceBand,
} from '../../domain/author-story-management.models';

@Component({
  selector: 'app-chapter-pricing',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, ButtonComponent],
  templateUrl: './chapter-pricing.component.html',
  styleUrl: './chapter-pricing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChapterPricingComponent {
  readonly pricing = input.required<AuthorChapterMonetization>();
  readonly bands = input<readonly MonetizationPriceBand[]>([]);
  readonly busy = input(false);
  readonly savePricing = output<AuthorChapterPricingInput>();
  protected readonly error = signal<string | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    accessType: ['FREE' as 'FREE' | 'PAID'],
    priceBandId: [''],
    unlockPolicy: ['PERMANENT_PAID' as 'PERMANENT_PAID' | 'EARLY_ACCESS'],
    schedule: ['days' as 'days' | 'date'],
    paidWindowDays: [7],
    freeAt: [''],
  });

  constructor() {
    effect(() => {
      const pricing = this.pricing();
      this.form.setValue({
        accessType: pricing.accessType,
        priceBandId: pricing.priceBandId ?? '',
        unlockPolicy: pricing.unlockPolicy ?? 'PERMANENT_PAID',
        schedule: pricing.paidWindowDays ? 'days' : pricing.freeAt ? 'date' : 'days',
        paidWindowDays: pricing.paidWindowDays ?? 7,
        freeAt: localDateTime(pricing.freeAt),
      });
    });
  }

  protected submit(): void {
    if (this.busy()) return;
    this.error.set(null);
    const value = this.form.getRawValue();
    if (value.accessType === 'FREE') {
      this.savePricing.emit({ accessType: 'FREE' });
      return;
    }
    if (!value.priceBandId) {
      this.error.set('Hãy chọn một mức giá Credit.');
      return;
    }
    const base: AuthorChapterPricingInput = {
      accessType: 'PAID',
      priceBandId: value.priceBandId,
      unlockPolicy: value.unlockPolicy,
    };
    if (value.unlockPolicy === 'PERMANENT_PAID') {
      this.savePricing.emit(base);
      return;
    }
    if (value.schedule === 'days') {
      if (
        !Number.isInteger(value.paidWindowDays) ||
        value.paidWindowDays < 1 ||
        value.paidWindowDays > 3650
      ) {
        this.error.set('Số ngày đọc sớm phải từ 1 đến 3650.');
        return;
      }
      this.savePricing.emit({ ...base, paidWindowDays: value.paidWindowDays });
      return;
    }
    const date = new Date(value.freeAt);
    if (!value.freeAt || !Number.isFinite(date.getTime())) {
      this.error.set('Hãy chọn thời điểm mở miễn phí hợp lệ.');
      return;
    }
    this.savePricing.emit({ ...base, freeAt: date.toISOString() });
  }
}

function localDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
