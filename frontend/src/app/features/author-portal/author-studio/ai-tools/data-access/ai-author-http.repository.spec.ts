import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { APP_RUNTIME_CONFIG } from '../../../../../core/config/app-config.token';
import { AiAuthorHttpRepository } from './ai-author-http.repository';

describe('AiAuthorHttpRepository contract', () => {
  let repository: AiAuthorHttpRepository;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AiAuthorHttpRepository,
        { provide: APP_RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    repository = TestBed.inject(AiAuthorHttpRepository);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });
  it('accepts empty 204 responses for character verification and issue resolution', async () => {
    const verification = firstValueFrom(repository.verify('story', 'character', true));
    const character = http.expectOne('/api/v1/author/stories/story/characters/character');
    expect(character.request.body).toEqual({ isVerified: true });
    character.flush(null, { status: 204, statusText: 'No Content' });
    await expect(verification).resolves.toBeNull();
    const resolution = firstValueFrom(
      repository.updateIssue('story', 'issue', { isResolved: true }),
    );
    const issue = http.expectOne('/api/v1/author/stories/story/consistency-issues/issue');
    expect(issue.request.body).toEqual({ isResolved: true });
    issue.flush(null, { status: 204, statusText: 'No Content' });
    await expect(resolution).resolves.toBeNull();
  });
  it('sends explicit connection and source version without changing fallback policy', async () => {
    const input = {
      connectionId: 'connection',
      chapterId: 'chapter',
      expectedVersion: 7,
      jobType: 'CHAPTER_SUMMARY' as const,
    };
    const created = firstValueFrom(repository.create('story', input));
    const request = http.expectOne('/api/v1/author/stories/story/ai-jobs');
    expect(request.request.body).toEqual(input);
    request.flush({ success: true, data: { id: 'job', status: 'PENDING' } });
    await expect(created).resolves.toMatchObject({ id: 'job', status: 'PENDING' });
  });
});
