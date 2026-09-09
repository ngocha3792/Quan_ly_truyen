import { ElevenLabsTtsAdapter } from './eleven-labs-tts.adapter';

describe('ElevenLabsTtsAdapter', () => {
  const adapter = new ElevenLabsTtsAdapter();

  afterEach(() => jest.restoreAllMocks());

  it('maps aligned characters into word timings', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          audio_base64: Buffer.from('mp3').toString('base64'),
          normalized_alignment: {
            characters: ['X', 'i', 'n', ' ', 'c', 'h', 'à', 'o'],
            character_start_times_seconds: [
              0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7,
            ],
            character_end_times_seconds: [
              0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8,
            ],
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const result = await adapter.generate({
      apiKey: 'secret',
      text: 'Xin chào',
      voiceId: 'voice-1',
      language: 'vi-VN',
      stability: 0.5,
      similarity: null,
      style: null,
    });

    expect(result.audioBuffer.toString()).toBe('mp3');
    expect(result.durationMs).toBe(800);
    expect(result.wordTimings).toEqual([
      { word: 'Xin', startMs: 0, endMs: 300 },
      { word: 'chào', startMs: 400, endMs: 800 },
    ]);
  });

  it('calculates the bounded character estimate without making a request', () => {
    expect(adapter.estimateCostMicros(1_000)).toBe(300_000n);
  });

  it('marks a missing voice as invalid', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(null, { status: 404 }));
    await expect(adapter.validateVoice('secret', 'missing')).resolves.toBe(
      false,
    );
  });
});
