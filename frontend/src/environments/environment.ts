export const environment = {
  production: false,

  /**
   * Development cũng đi qua Angular proxy.
   *
   * Không gọi thẳng:
   *
   * http://localhost:3000/api/v1
   *
   * vì như vậy browser/API/cookie có thể khác host.
   */
  apiBaseUrl: '/api/v1',

  appName: 'TruyenHub',
} as const;
