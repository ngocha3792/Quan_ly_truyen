import { parseSampleRatio, startTelemetry } from './instrumentation';

describe('instrumentation configuration', () => {
  it.each([
    ['-1', 0],
    ['2', 1],
    ['0.25', 0.25],
    ['invalid', 1],
  ])('clamps sample ratio %s to %s', (raw, expected) => {
    expect(parseSampleRatio(raw)).toBe(expected);
  });

  it('does not fail bootstrap when the SDK is disabled', async () => {
    const previous = process.env.OTEL_SDK_DISABLED;
    process.env.OTEL_SDK_DISABLED = 'true';
    await expect(startTelemetry()).resolves.toBeUndefined();
    if (previous === undefined) delete process.env.OTEL_SDK_DISABLED;
    else process.env.OTEL_SDK_DISABLED = previous;
  });
});
