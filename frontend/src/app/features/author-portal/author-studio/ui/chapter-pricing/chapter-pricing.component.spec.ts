import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChapterPricingComponent } from './chapter-pricing.component';

describe('ChapterPricingComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  function setup() {
    const fixture = TestBed.createComponent(ChapterPricingComponent);
    fixture.componentRef.setInput('pricing', {
      chapterId: 'chapter',
      accessType: 'PAID',
      priceBandId: 'band',
      creditPrice: '5',
      previewContent: null,
      version: 1,
      updatedAt: '',
      unlockPolicy: 'EARLY_ACCESS',
      paidWindowDays: 7,
      freeAt: '2026-09-15T12:00:00Z',
    });
    fixture.componentRef.setInput('bands', [{ id: 'band', label: 'Cơ bản', creditPrice: '5' }]);
    fixture.detectChanges();
    const emit = vi.fn();
    fixture.componentInstance.savePricing.subscribe(emit);
    return { fixture, emit, element: fixture.nativeElement as HTMLElement };
  }

  it('preserves a publication-relative window when backend also returns a resolved deadline', () => {
    const { fixture, emit, element } = setup();
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(emit).toHaveBeenCalledWith({
      accessType: 'PAID',
      priceBandId: 'band',
      unlockPolicy: 'EARLY_ACCESS',
      paidWindowDays: 7,
    });
    expect(element.textContent).toContain('mỗi ngày là 24 giờ');
  });

  it('blocks invalid paid window before making an API request', () => {
    const { fixture, emit, element } = setup();
    const input = element.querySelector<HTMLInputElement>('input[type=number]')!;
    input.value = '0';
    input.dispatchEvent(new Event('input'));
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(emit).not.toHaveBeenCalled();
    expect(element.querySelector('[role=alert]')?.textContent).toContain('1 đến 3650');
  });

  it('clears early-access scheduling when author switches to a free chapter', () => {
    const { fixture, emit, element } = setup();
    const select = element.querySelector<HTMLSelectElement>('select[formControlName=accessType]')!;
    select.value = 'FREE';
    select.dispatchEvent(new Event('change'));
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(emit).toHaveBeenCalledWith({ accessType: 'FREE' });
  });
});
