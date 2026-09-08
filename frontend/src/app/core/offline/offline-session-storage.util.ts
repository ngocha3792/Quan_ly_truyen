const LEGACY_PENDING_PROGRESS_PREFIX = 'qlt:reading-progress:pending:';

export function clearLegacyPendingReadingProgress(storage: Storage): number {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(LEGACY_PENDING_PROGRESS_PREFIX)) keys.push(key);
  }
  keys.forEach((key) => storage.removeItem(key));
  return keys.length;
}
