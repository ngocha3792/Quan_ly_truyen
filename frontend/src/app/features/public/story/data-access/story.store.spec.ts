import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthStore } from '../../../../core/auth/auth.store';
import { AuthorFollowApiService } from '../../../../core/author-follow';
import type { Story, StoryComment } from '../domain/story.models';
import { StoryDetailRepository } from './story.repository';
import { StoryDetailStore } from './story.store';

describe('story comment initial load', () => {
  afterEach(() => TestBed.resetTestingModule());
  function setup() {
    const read = new Subject<readonly StoryComment[]>();
    const created = { id: 'new', content: 'New comment' } as StoryComment;
    const repository = {
      getStoryBySlug: vi
        .fn()
        .mockReturnValue(
          of({ id: 'story', slug: 'story', categories: [], followers: 0 } as unknown as Story),
        ),
      getComments: () => read,
      getRelatedStories: () => of([]),
      createComment: () => of(created),
    };
    TestBed.configureTestingModule({
      providers: [
        StoryDetailStore,
        { provide: StoryDetailRepository, useValue: repository },
        { provide: AuthStore, useValue: { ensureInitialized: () => of('anonymous') } },
        { provide: AuthorFollowApiService, useValue: {} },
      ],
    });
    const store = TestBed.inject(StoryDetailStore);
    store.loadStory('story');
    return { store, read, created };
  }
  it('does not erase a successful comment when the initial GET resolves late', () => {
    const { store, read, created } = setup();
    store.addComment('New comment');
    expect(store.comments()).toEqual([created]);
    read.next([]);
    read.complete();
    expect(store.comments()).toEqual([created]);
  });
  it('still shows the initial comments when no newer update exists', () => {
    const { store, read, created } = setup();
    read.next([created]);
    read.complete();
    expect(store.comments()).toEqual([created]);
  });
});
