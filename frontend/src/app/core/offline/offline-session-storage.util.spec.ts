import { clearLegacyPendingReadingProgress } from './offline-session-storage.util';

describe('clearLegacyPendingReadingProgress', () => {
  it('clears only app-owned pending progress keys', () => {
    localStorage.setItem('qlt:reading-progress:pending:user-1:story-1', '{}');
    localStorage.setItem('qlt:reading-progress:device-id', 'device-1');
    localStorage.setItem('unrelated', 'keep');

    expect(clearLegacyPendingReadingProgress(localStorage)).toBe(1);
    expect(localStorage.getItem('qlt:reading-progress:pending:user-1:story-1')).toBeNull();
    expect(localStorage.getItem('qlt:reading-progress:device-id')).toBe('device-1');
    expect(localStorage.getItem('unrelated')).toBe('keep');
  });
});
