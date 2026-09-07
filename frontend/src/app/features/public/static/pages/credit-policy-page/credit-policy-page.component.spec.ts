import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { describe, expect, it } from 'vitest';

import { CreditPolicyPageComponent } from './credit-policy-page.component';

describe('CreditPolicyPageComponent', () => {
  it('publishes the accepted credit and paid-content policy', async () => {
    await TestBed.configureTestingModule({
      imports: [CreditPolicyPageComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(CreditPolicyPageComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Chính sách Credit và mở khóa chương');
    expect(text).toContain('không quy đổi hoặc rút thành tiền mặt');
    expect(text).toContain('Mở khóa chương trả phí');
    expect(text).toContain('Hoàn tiền và giao dịch lỗi');
  });
});
