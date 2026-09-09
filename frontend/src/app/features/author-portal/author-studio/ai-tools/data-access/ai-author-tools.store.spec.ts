import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiAuthorJob } from '../domain/ai-author.models';
import { AiAuthorRepository } from '../domain/ai-author.repository';
import { AiAuthorToolsStore } from './ai-author-tools.store';

describe('AiAuthorToolsStore', () => {
  const repository = {
    connections: vi.fn(),
    policy: vi.fn(),
    jobs: vi.fn(),
    characters: vi.fn(),
    issues: vi.fn(),
    create: vi.fn(),
  };
  let store: AiAuthorToolsStore;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    repository.connections.mockReturnValue(of([]));
    repository.policy.mockReturnValue(of({ fallbackPolicy: 'NONE' }));
    repository.characters.mockReturnValue(of([]));
    repository.issues.mockReturnValue(of([]));
    TestBed.configureTestingModule({
      providers: [AiAuthorToolsStore, { provide: AiAuthorRepository, useValue: repository }],
    });
    store = TestBed.inject(AiAuthorToolsStore);
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });
  it('refreshes after creating a job while an earlier list request is still pending', () => {
    const firstList = new Subject<readonly AiAuthorJob[]>();
    const job = { id: 'job', status: 'PENDING' } as AiAuthorJob;
    repository.jobs.mockReturnValueOnce(firstList).mockReturnValue(of([job]));
    repository.create.mockReturnValue(of(job));
    store.load('story');
    store.create({ jobType: 'STORY_SUMMARY', connectionId: 'connection' });
    firstList.next([]);
    firstList.complete();
    expect(repository.jobs).toHaveBeenCalledTimes(2);
    expect(store.jobs()).toEqual([job]);
  });
  it('polls unfinished work and stops after completion or teardown', async () => {
    repository.jobs
      .mockReturnValueOnce(of([{ id: 'job', status: 'PROCESSING' }]))
      .mockReturnValue(of([{ id: 'job', status: 'COMPLETED' }]));
    store.load('story');
    await vi.advanceTimersByTimeAsync(3000);
    expect(store.jobs()[0].status).toBe('COMPLETED');
    await vi.advanceTimersByTimeAsync(6000);
    expect(repository.jobs).toHaveBeenCalledTimes(2);
  });
});
