import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      /*
       * Dùng bản bundle cho trình duyệt của mammoth, đúng bản người dùng chạy.
       *
       * Không alias thì test nhận bản Node: bản Node chỉ đọc được `buffer`,
       * bản browser chỉ đọc được `arrayBuffer`. Test khi đó kiểm một nhánh mã
       * không bao giờ tới tay người dùng.
       */
      { find: /^mammoth$/, replacement: 'mammoth/mammoth.browser.js' },
    ],
  },
  test: {
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
