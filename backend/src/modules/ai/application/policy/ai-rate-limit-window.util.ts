export function aiRateLimitWindowStart(at: Date, windowSeconds: number): Date {
  const windowMs = windowSeconds * 1_000;
  return new Date(Math.floor(at.getTime() / windowMs) * windowMs);
}

export function aiRateLimitResetAt(
  windowStart: Date,
  windowSeconds: number,
): Date {
  return new Date(windowStart.getTime() + windowSeconds * 1_000);
}
