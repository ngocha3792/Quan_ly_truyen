import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { APP_RUNTIME_CONFIG } from '../config/app-config.token';
import { SearchApiClient } from './search-api.client';

describe('SearchApiClient', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    }),
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  it('encodes Vietnamese queries and preserves false filters and paging', () => {
    const received = vi.fn();
    TestBed.inject(SearchApiClient)
      .search({ q: 'Đấu phá & tiên hiệp', kind: 'chapter', page: 2, featured: false, tag: '' })
      .subscribe(received);
    const request = TestBed.inject(HttpTestingController).expectOne(
      (req) => req.url === '/api/v1/search',
    );
    expect(request.request.params.get('q')).toBe('Đấu phá & tiên hiệp');
    expect(request.request.params.get('featured')).toBe('false');
    expect(request.request.params.has('tag')).toBe(false);
    expect(request.request.params.get('page')).toBe('2');
    request.flush({ success: true, data: { hits: [], totalHits: 0 } });
    expect(received).toHaveBeenCalledWith({ hits: [], totalHits: 0 });
  });
});
