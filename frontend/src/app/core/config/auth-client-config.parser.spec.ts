import { parseAuthClientConfigResponse } from './auth-client-config.parser';

describe('parseAuthClientConfigResponse', () => {
  it('parses the backend-owned auth client contract', () => {
    expect(
      parseAuthClientConfigResponse({
        success: true,
        data: {
          features: {
            monetizationEnabled: true,
            paymentProviderEnabled: false,
            contentDocumentEnabled: true,
            portableCursorEnabled: true,
            realtimeProgressSyncEnabled: true,
            inlineCommentsEnabled: true,
            comicDeliveryEnabled: true,
            offlineReadingEnabled: true,
          },
          passwordPolicy: {
            minimumLength: 10,
            maximumLength: 64,
            maximumBytes: 72,
            requireLowercase: true,
            requireUppercase: true,
            requireNumber: true,
            requireSymbol: false,
          },
          passwordReset: {
            tokenExpiresInMinutes: 30,
          },
          csrf: {
            enabled: true,
            cookieName: 'csrf-token',
            headerName: 'x-csrf-token',
          },
        },
      }),
    ).toEqual({
      features: {
        monetizationEnabled: true,
        paymentProviderEnabled: false,
        contentDocumentEnabled: true,
        portableCursorEnabled: true,
        realtimeProgressSyncEnabled: true,
        inlineCommentsEnabled: true,
        comicDeliveryEnabled: true,
        offlineReadingEnabled: true,
      },
      passwordPolicy: {
        minimumLength: 10,
        maximumLength: 64,
        maximumBytes: 72,
        requireLowercase: true,
        requireUppercase: true,
        requireNumber: true,
        requireSymbol: false,
      },
      passwordReset: {
        tokenExpiresInMinutes: 30,
      },
      csrf: {
        enabled: true,
        cookieName: 'csrf-token',
        headerName: 'x-csrf-token',
      },
    });
  });

  it('rejects invalid password policy ranges', () => {
    expect(() =>
      parseAuthClientConfigResponse({
        success: true,
        data: {
          features: {
            monetizationEnabled: false,
            paymentProviderEnabled: false,
            contentDocumentEnabled: false,
            portableCursorEnabled: false,
            realtimeProgressSyncEnabled: false,
            inlineCommentsEnabled: false,
            comicDeliveryEnabled: false,
            offlineReadingEnabled: false,
          },
          passwordPolicy: {
            minimumLength: 72,
            maximumLength: 8,
            maximumBytes: 72,
            requireLowercase: true,
            requireUppercase: true,
            requireNumber: true,
            requireSymbol: true,
          },
          passwordReset: { tokenExpiresInMinutes: 15 },
          csrf: {
            enabled: true,
            cookieName: 'csrf-token',
            headerName: 'x-csrf-token',
          },
        },
      }),
    ).toThrowError(/length range/);
  });
});
