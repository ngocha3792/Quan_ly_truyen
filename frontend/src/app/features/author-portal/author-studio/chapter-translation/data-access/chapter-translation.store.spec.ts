import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChapterTranslation } from '../domain/chapter-translation.models';
import { ChapterTranslationRepository } from '../domain/chapter-translation.repository';
import { ChapterTranslationStore } from './chapter-translation.store';

const translation = {
  id: 'translation',
  targetLanguageCode: 'en',
  status: 'PENDING',
  generation: 1,
  sourceVersion: 2,
} as ChapterTranslation;
describe('ChapterTranslationStore lifecycle', () => {
  const repository = { get: vi.fn(), request: vi.fn() };
  let store: ChapterTranslationStore;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [
        ChapterTranslationStore,
        { provide: ChapterTranslationRepository, useValue: repository },
      ],
    });
    store = TestBed.inject(ChapterTranslationStore);
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });
  it('polls pending work until completed and then stops', async () => {
    repository.get
      .mockReturnValueOnce(of(translation))
      .mockReturnValue(of({ ...translation, status: 'COMPLETED' }));
    store.refresh('story', 'chapter', 'en');
    await vi.advanceTimersByTimeAsync(3000);
    expect(store.translation()?.status).toBe('COMPLETED');
    await vi.advanceTimersByTimeAsync(9000);
    expect(repository.get).toHaveBeenCalledTimes(2);
  });
  it('ignores an older language response after selection changes', () => {
    const previous = new Subject<ChapterTranslation>();
    repository.get
      .mockReturnValueOnce(previous)
      .mockReturnValue(of({ ...translation, targetLanguageCode: 'ja', status: 'COMPLETED' }));
    store.refresh('story', 'chapter', 'en');
    store.refresh('story', 'chapter', 'ja');
    previous.next(translation);
    previous.complete();
    expect(store.translation()?.targetLanguageCode).toBe('ja');
    expect(store.requesting()).toBe(false);
  });
  it('stops pending polling when leaving the editor', async () => {
    repository.get.mockReturnValue(of(translation));
    store.refresh('story', 'chapter', 'en');
    TestBed.resetTestingModule();
    await vi.advanceTimersByTimeAsync(6000);
    expect(repository.get).toHaveBeenCalledTimes(1);
  });
});
