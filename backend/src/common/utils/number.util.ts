export function clamp(value: number, min: number, max: number): number {
  if (![value, min, max].every(Number.isFinite)) {
    throw new TypeError('value, min và max phải là số hữu hạn');
  }

  if (min > max) {
    throw new RangeError('min không được lớn hơn max');
  }

  return Math.min(Math.max(value, min), max);
}

export function roundTo(value: number, decimalPlaces = 2): number {
  if (!Number.isFinite(value)) {
    throw new TypeError('value phải là số hữu hạn');
  }

  if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 10) {
    throw new RangeError('decimalPlaces phải nằm trong khoảng 0-10');
  }

  const factor = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function parseInteger(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? value : null;
  }

  if (typeof value !== 'string' || !/^-?\d+$/.test(value.trim())) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}
