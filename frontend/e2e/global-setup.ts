import { runBackendScript } from './support/backend-script';

export default function globalSetup(): void {
  /**
   * External E2E có thể trỏ vào staging/production-like environment.
   * Tuyệt đối không tự động seed database ở chế độ này.
   */
  if (process.env['E2E_EXTERNAL'] === 'true') {
    return;
  }

  console.log('[Playwright] Chuẩn bị dữ liệu E2E deterministic...');

  runBackendScript('db:seed:e2e:all');
}
