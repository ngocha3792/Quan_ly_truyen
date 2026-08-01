import { EventEmitter } from 'node:events';

import { throwError } from 'rxjs';

import { HttpMetricsInterceptor } from './http-metrics.interceptor';

describe('HttpMetricsInterceptor', () => {
  it('finalizes once with a route template after an error response finishes', () => {
    const metrics = {
      isEnabled: jest.fn().mockReturnValue(true),
      recordHttpStart: jest.fn(),
      recordHttpFinish: jest.fn(),
    };
    const response = Object.assign(new EventEmitter(), { statusCode: 500 });
    const interceptor = new HttpMetricsInterceptor(metrics as never);
    const stream = interceptor.intercept(
      {
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => ({
            method: 'GET',
            baseUrl: '/api/v1',
            route: { path: '/stories/:id' },
            originalUrl: '/api/v1/stories/private-value',
          }),
          getResponse: () => response,
        }),
      } as never,
      { handle: () => throwError(() => new Error('controlled')) },
    );
    stream.subscribe({ error: () => undefined });
    response.emit('finish');
    response.emit('close');

    expect(metrics.recordHttpStart).toHaveBeenCalledWith('GET');
    expect(metrics.recordHttpFinish).toHaveBeenCalledTimes(1);
    const [[finishInput]] = metrics.recordHttpFinish.mock
      .calls as unknown as Array<
      [{ route: string; statusCode: number; durationSeconds: number }]
    >;
    expect(finishInput.route).toBe('/api/v1/stories/:id');
    expect(finishInput.statusCode).toBe(500);
    expect(finishInput.durationSeconds).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(metrics.recordHttpFinish.mock.calls)).not.toContain(
      'private-value',
    );
  });
});
