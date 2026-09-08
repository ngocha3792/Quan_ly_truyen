import { CloudinaryUrlAdapter } from './cloudinary-url.adapter';

describe('CloudinaryUrlAdapter', () => {
  it('builds signed, cropped AVIF slice URLs without exposing raw coordinates elsewhere', () => {
    const url = jest.fn().mockReturnValue('signed-url');
    const adapter = new CloudinaryUrlAdapter({ url } as never);
    expect(
      adapter.build({
        publicId: 'chapter/page-1',
        resourceType: 'image',
        preset: 'chapterImage',
        preferredFormat: 'avif',
        slice: { offsetY: 1600, height: 1200 },
        requiresSigning: true,
      }),
    ).toBe('signed-url');
    const calls = url.mock.calls as unknown as ReadonlyArray<
      readonly [string, { sign_url: boolean; transformation: unknown[] }]
    >;
    expect(calls[0]?.[0]).toBe('chapter/page-1');
    expect(calls[0]?.[1].sign_url).toBe(true);
    expect(calls[0]?.[1].transformation).toEqual(
      expect.arrayContaining([
        { crop: 'crop', gravity: 'north', y: 1600, height: 1200 },
        expect.objectContaining({ fetch_format: 'avif' }),
      ]),
    );
  });
});
