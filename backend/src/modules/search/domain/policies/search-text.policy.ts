import { InvalidInputException } from '@/common/exceptions';
import type { SearchInput } from '../search.models';

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[đĐ]/gu, 'd')
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .trim();
}

export function searchPlainText(value: string): string {
  return value
    .replace(/<[^>]*>/gu, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, '$1')
    .replace(/[#*_`>~]/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function searchSnippet(content: string, query: string): string {
  const plain = searchPlainText(content);
  const token = normalizeSearchText(query).split(' ')[0] ?? '';
  const position = normalizeSearchText(plain).indexOf(token);
  const start = Math.max(0, position - 60);
  return `${start ? '…' : ''}${plain.slice(start, start + 240)}${plain.length > start + 240 ? '…' : ''}`;
}

export function validateSearchInput(input: SearchInput): SearchInput {
  if (input.yearFrom && input.yearTo && input.yearFrom > input.yearTo) {
    throw new InvalidInputException({
      message: 'Năm bắt đầu phải nhỏ hơn hoặc bằng năm kết thúc',
    });
  }
  return { ...input, q: input.q.trim().replace(/\s+/gu, ' ') };
}
