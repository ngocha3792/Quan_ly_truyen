import { InvalidInputException } from '@/common/exceptions';

import { parseReadingCursor } from './reading-cursor.value-object';

describe('reading cursor', () => {
  it('accepts a portable text position', () => {
    expect(
      parseReadingCursor({
        schemaVersion: 1,
        kind: 'text',
        blockId: '11111111-1111-4111-8111-111111111111',
        characterOffset: 42,
        viewportRatio: 0.35,
      }),
    ).toEqual({
      schemaVersion: 1,
      kind: 'text',
      blockId: '11111111-1111-4111-8111-111111111111',
      characterOffset: 42,
      viewportRatio: 0.35,
    });
  });

  it('accepts comic coordinates relative to an asset or slice', () => {
    expect(
      parseReadingCursor({
        schemaVersion: 1,
        kind: 'comic',
        mediaAssetId: '22222222-2222-4222-8222-222222222222',
        relativeY: 0.75,
      }),
    ).toMatchObject({ kind: 'comic', relativeY: 0.75 });
  });

  it('rejects absolute pixel positions', () => {
    expect(() =>
      parseReadingCursor({
        schemaVersion: 1,
        kind: 'comic',
        mediaAssetId: '22222222-2222-4222-8222-222222222222',
        relativeY: 480,
      }),
    ).toThrow(InvalidInputException);
  });
});
