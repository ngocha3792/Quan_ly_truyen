import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import { BusinessRuleViolationException } from '@/common/exceptions';

const PRIVATE_IPV4_RANGES: readonly [number, number][] = [
  [ipToInt('10.0.0.0'), ipToInt('10.255.255.255')],
  [ipToInt('172.16.0.0'), ipToInt('172.31.255.255')],
  [ipToInt('192.168.0.0'), ipToInt('192.168.255.255')],
  [ipToInt('127.0.0.0'), ipToInt('127.255.255.255')],
  [ipToInt('169.254.0.0'), ipToInt('169.254.255.255')],
  [ipToInt('0.0.0.0'), ipToInt('0.255.255.255')],
];

function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => acc * 256 + Number(octet), 0);
}

function isPrivateIpv4(address: string): boolean {
  const value = ipToInt(address);
  return PRIVATE_IPV4_RANGES.some(
    ([start, end]) => value >= start && value <= end,
  );
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  return (
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80') ||
    normalized.startsWith('::ffff:127.') ||
    normalized.startsWith('::ffff:10.') ||
    normalized.startsWith('::ffff:192.168.')
  );
}

function isPrivateAddress(address: string): boolean {
  return isIP(address) === 4 ? isPrivateIpv4(address) : isPrivateIpv6(address);
}

/**
 * Refuses to let user-supplied "OpenAI compatible" base URLs reach internal
 * infrastructure (cloud metadata endpoints, localhost services, private
 * subnets) before any outbound request is made.
 */
export async function assertPublicHttpsUrl(rawUrl: string): Promise<URL> {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new BusinessRuleViolationException({
      message: 'Base URL không hợp lệ.',
      rule: 'ai-connection.base-url-invalid',
    });
  }

  if (url.protocol !== 'https:') {
    throw new BusinessRuleViolationException({
      message: 'Base URL phải dùng https.',
      rule: 'ai-connection.base-url-scheme',
    });
  }

  if (isIP(url.hostname) && isPrivateAddress(url.hostname)) {
    throw new BusinessRuleViolationException({
      message: 'Base URL không được trỏ tới địa chỉ mạng nội bộ.',
      rule: 'ai-connection.base-url-private-network',
    });
  }

  if (!isIP(url.hostname)) {
    if (url.hostname === 'localhost') {
      throw new BusinessRuleViolationException({
        message: 'Base URL không được trỏ tới địa chỉ mạng nội bộ.',
        rule: 'ai-connection.base-url-private-network',
      });
    }

    let resolved: { address: string }[];

    try {
      resolved = await dnsLookup(url.hostname, { all: true });
    } catch {
      throw new BusinessRuleViolationException({
        message: 'Không thể phân giải tên miền của Base URL.',
        rule: 'ai-connection.base-url-unresolvable',
      });
    }

    if (resolved.some((entry) => isPrivateAddress(entry.address))) {
      throw new BusinessRuleViolationException({
        message: 'Base URL không được trỏ tới địa chỉ mạng nội bộ.',
        rule: 'ai-connection.base-url-private-network',
      });
    }
  }

  return url;
}

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

/**
 * fetch() wrapper for outbound calls to a user-supplied base URL: no
 * redirects (redirect targets are never re-validated) and a hard cap on how
 * much of the response body is read.
 */
export async function safeExternalFetch(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const response = await fetch(url, { ...init, redirect: 'error' });

  const contentLength = response.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) {
    throw new BusinessRuleViolationException({
      message: 'Phản hồi từ máy chủ AI vượt quá giới hạn cho phép.',
      rule: 'ai-connection.response-too-large',
    });
  }

  return response;
}

/**
 * Reads a response body as text, aborting once MAX_RESPONSE_BYTES have been
 * read even if the server never sends a (truthful) Content-Length header.
 */
export async function readBodyWithLimit(response: Response): Promise<string> {
  if (!response.body) {
    return response.text();
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    received += value.byteLength;
    if (received > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new BusinessRuleViolationException({
        message: 'Phản hồi từ máy chủ AI vượt quá giới hạn cho phép.',
        rule: 'ai-connection.response-too-large',
      });
    }

    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return text;
}
