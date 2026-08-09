import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideRouter } from '@angular/router';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthorApplicationConfig } from '../../domain/author-application.models';

import { AuthorApplicationFormComponent } from './author-application-form.component';

describe('AuthorApplicationFormComponent verified-email policy', () => {
  let fixture: ComponentFixture<AuthorApplicationFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthorApplicationFormComponent],

      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthorApplicationFormComponent);

    fixture.componentRef.setInput(
      'config',

      CONFIG,
    );
  });

  afterEach(() => {
    fixture.destroy();

    TestBed.resetTestingModule();
  });

  it('user chưa verify email không được lưu draft hoặc submit', () => {
    const component = fixture.componentInstance;

    const saveSpy = vi.fn();

    const submitSpy = vi.fn();

    component.saveDraft.subscribe(saveSpy);

    component.submitApplication.subscribe(submitSpy);

    fixture.componentRef.setInput(
      'emailVerified',

      false,
    );

    fixture.detectChanges();

    const nativeElement = fixture.nativeElement as HTMLElement;

    const draftButton = nativeElement.querySelector<HTMLButtonElement>('.draft-button');

    const submitButton = nativeElement.querySelector<HTMLButtonElement>('.submit-button');

    expect(draftButton).not.toBeNull();

    expect(submitButton).not.toBeNull();

    expect(draftButton?.disabled).toBe(true);

    expect(submitButton?.disabled).toBe(true);

    draftButton?.click();

    submitButton?.click();

    expect(saveSpy).not.toHaveBeenCalled();

    expect(submitSpy).not.toHaveBeenCalled();

    expect(nativeElement.textContent).toContain('Email chưa được xác minh');

    expect(nativeElement.textContent).toContain('xác minh email của tài khoản');
  });

  it('user đã verify email được phép lưu draft và dùng submit', () => {
    fixture.componentRef.setInput(
      'emailVerified',

      true,
    );

    fixture.detectChanges();

    const nativeElement = fixture.nativeElement as HTMLElement;

    const draftButton = nativeElement.querySelector<HTMLButtonElement>('.draft-button');

    const submitButton = nativeElement.querySelector<HTMLButtonElement>('.submit-button');

    expect(draftButton?.disabled).toBe(false);

    expect(submitButton?.disabled).toBe(false);

    expect(nativeElement.textContent).not.toContain('Email chưa được xác minh');
  });
});

const CONFIG: AuthorApplicationConfig = {
  genreOptions: [
    {
      value: 'fantasy',

      label: 'Fantasy',
    },
  ],

  experienceOptions: [
    {
      value: 'beginner',

      label: 'Mới bắt đầu',
    },
  ],

  requirements: [],

  reviewSteps: [],

  benefits: [],

  acceptedFileExtensions: ['.docx'],

  maximumFileSizeMb: 5,

  introductionMaximumLength: 1_000,

  synopsisMaximumLength: 2_000,
};
