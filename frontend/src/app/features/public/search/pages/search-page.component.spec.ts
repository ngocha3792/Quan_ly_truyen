import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchApiClient } from '../../../../core/http/search-api.client';
import { SearchPageComponent } from './search-page.component';

describe('search navigation and draft input', () => {
  afterEach(() => TestBed.resetTestingModule());
  function setup() {
    const params = new BehaviorSubject(convertToParamMap({ q: 'old', kind: 'story' }));
    const search = vi.fn().mockReturnValue(of(null));
    const navigate = vi.fn().mockImplementation(() => new Promise<boolean>(() => {}));
    TestBed.configureTestingModule({
      providers: [
        SearchPageComponent,
        {
          provide: SearchApiClient,
          useValue: { search, filters: () => of({ categories: [], tags: [] }) },
        },
        { provide: ActivatedRoute, useValue: { queryParamMap: params } },
        { provide: Router, useValue: { navigate } },
      ],
    });
    const component = TestBed.inject(SearchPageComponent) as unknown as {
      q: string;
      kind: string;
      submit(): void;
      retry(): void;
      selectKind(kind: string): void;
    };
    return { component, params, navigate, search };
  }
  it('keeps a keyword typed before the preceding tab navigation emits, querying the actual URL', () => {
    const { component, params, navigate, search } = setup();
    component.selectKind('chapter');
    component.q = 'navigation';
    params.next(convertToParamMap({ q: 'old', kind: 'chapter', page: '1' }));
    expect(component.q).toBe('navigation');
    expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'old', kind: 'chapter' }));
    component.submit();
    expect(navigate).toHaveBeenLastCalledWith(['/tim-kiem'], {
      queryParams: expect.objectContaining({ q: 'navigation', kind: 'chapter' }),
    });
  });
  it('restores keyword and filters for external Back/Forward navigation', () => {
    const { component, params } = setup();
    component.q = 'unsent';
    params.next(convertToParamMap({ q: 'history', kind: 'chapter' }));
    expect(component.q).toBe('history');
    expect(component.kind).toBe('chapter');
  });
  it('retries the URL query without discarding unsent text', () => {
    const { component, search } = setup();
    component.q = 'unsent';
    component.retry();
    expect(component.q).toBe('unsent');
    expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'old' }));
  });
});
