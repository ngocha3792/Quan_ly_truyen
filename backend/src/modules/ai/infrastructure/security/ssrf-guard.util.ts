import { lookup as dnsLookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

import { BusinessRuleViolationException } from '@/common/exceptions';

const BLOCKED_ADDRESSES = new BlockList();

for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  BLOCKED_ADDRESSES.addSubnet(network, prefix, 'ipv4');
}

for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['100::', 64],
  ['2001:10::', 28],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  BLOCKED_ADDRESSES.addSubnet(network, prefix, 'ipv6');
}

function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  return (
    family === 0 ||
    BLOCKED_ADDRESSES.check(address, family === 4 ? 'ipv4' : 'ipv6')
  );
}

const SPECIAL_USE_HOST_SUFFIXES = [
  '.home.arpa',
  '.internal',
  '.invalid',
  '.local',
  '.localhost',
  '.test',
] as const;

/**
 * Refuses to let user-supplied "OpenAI compatible" base URLs reach internal
 * infrastructure (cloud metadata endpoints, localhost services, private
 * subnets) before any outbound request is made.
 */
export async function assertPublicHttpsUrl(rawUrl: string): Promise<URL> {
  return validatePublicHttpsUrl(rawUrl, false);
}

async function validatePublicHttpsUrl(
  rawUrl: string,
  allowQuery: boolean,
): Promise<URL> {
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

  if (url.username || url.password || (!allowQuery && url.search) || url.hash) {
    throw new BusinessRuleViolationException({
      message:
        'Base URL không được chứa thông tin đăng nhập, query string hoặc fragment.',
      rule: 'ai-connection.base-url-components',
    });
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();

  if (isIP(hostname) && isPrivateAddress(hostname)) {
    throw new BusinessRuleViolationException({
      message: 'Base URL không được trỏ tới địa chỉ mạng nội bộ.',
      rule: 'ai-connection.base-url-private-network',
    });
  }

  if (!isIP(hostname)) {
    const normalizedHostname = hostname.replace(/\.$/, '');
    if (
      normalizedHostname === 'localhost' ||
      SPECIAL_USE_HOST_SUFFIXES.some((suffix) =>
        normalizedHostname.endsWith(suffix),
      )
    ) {
      throw new BusinessRuleViolationException({
        message: 'Base URL không được trỏ tới địa chỉ mạng nội bộ.',
        rule: 'ai-connection.base-url-private-network',
      });
    }

    let resolved: { address: string }[];

    try {
      resolved = await dnsLookup(normalizedHostname, { all: true });
    } catch {
      throw new BusinessRuleViolationException({
        message: 'Không thể phân giải tên miền của Base URL.',
        rule: 'ai-connection.base-url-unresolvable',
      });
    }

    if (
      resolved.length === 0 ||
      resolved.some((entry) => isPrivateAddress(entry.address))
    ) {
      throw new BusinessRuleViolationException({
        message: 'Base URL không được trỏ tới địa chỉ mạng nội bộ.',
        rule: 'ai-connection.base-url-private-network',
      });
    }
  }

  return url;
}

export const AI_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

/**
 * fetch() wrapper for outbound calls to a user-supplied base URL: no
 * redirects (redirect targets are never re-validated) and a hard cap on how
 * much of the response body is read.
 */
export async function safeExternalFetch(
  url: string,
  init: RequestInit,
): Promise<Response> {
  // Re-resolve immediately before every request. This catches records changed
  // after connection creation and substantially narrows DNS-rebinding windows.
  await validatePublicHttpsUrl(url, true);
  const response = await fetch(url, { ...init, redirect: 'error' });

  const contentLength = response.headers.get('content-length');
  if (
    contentLength &&
    Number.isFinite(Number(contentLength)) &&
    Number(contentLength) > AI_MAX_RESPONSE_BYTES
  ) {
    await response.body?.cancel();
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
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > AI_MAX_RESPONSE_BYTES) {
      throw new BusinessRuleViolationException({
        message: 'Phản hồi từ máy chủ AI vượt quá giới hạn cho phép.',
        rule: 'ai-connection.response-too-large',
      });
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    received += value.byteLength;
    if (received > AI_MAX_RESPONSE_BYTES) {
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
