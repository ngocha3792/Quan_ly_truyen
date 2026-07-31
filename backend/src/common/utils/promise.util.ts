export function sleep(
  milliseconds: number,
  signal?: AbortSignal,
): Promise<void> {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    return Promise.reject(
      new RangeError('milliseconds phải là số không âm'),
    );
  }

  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error('Operation aborted'));
      return;
    }

    const timeoutId = setTimeout(resolve, milliseconds);

    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timeoutId);
        reject(signal.reason ?? new Error('Operation aborted'));
      },
      { once: true },
    );
  });
}

export async function withTimeout<T>(
  promise: Promise<T>,
  milliseconds: number,
  message = 'Operation timed out',
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), milliseconds);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}
