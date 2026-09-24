import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const CSRF_HEADER_NAME = 'x-csrf-token';

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function readJsonBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function describeApiError(body) {
  if (body && typeof body === 'object' && 'error' in body) {
    const error = body.error;
    if (error?.message) return `${error.code ?? 'ERROR'}: ${error.message}`;
  }
  return typeof body === 'string' ? body : JSON.stringify(body);
}

function parseSetCookies(response) {
  const raw =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [];
  const jar = {};
  for (const line of raw) {
    const first = line.split(';')[0];
    const eq = first.indexOf('=');
    if (eq === -1) continue;
    jar[first.slice(0, eq).trim()] = first.slice(eq + 1).trim();
  }
  return jar;
}

function cookieHeaderFrom(jar) {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function findCsrfValue(jar) {
  const key = Object.keys(jar).find((k) => k.toLowerCase().includes('csrf'));
  return key ? jar[key] : undefined;
}

/**
 * Manages one logged-in identity (author or admin) against the site's public API.
 * Persists the rotating refresh-token cookie to disk so a fresh TOTP code is
 * only needed once; every subsequent call transparently refreshes the short-lived
 * access token before it expires, and retries once on a stray TOKEN_EXPIRED.
 */
export class AuthSession {
  constructor(baseUrl, sessionFilePath, credentials) {
    this.baseUrl = baseUrl;
    this.filePath = sessionFilePath;
    this.credentials = credentials; // { identifier, password, totp }
    this.cookies = {};
    this.accessToken = null;
    this.accessTokenExpiresAt = null;
    this.label = credentials?.label ?? 'session';
    this.onLog = credentials?.onLog ?? (() => {});
  }

  async load() {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const data = JSON.parse(raw);
      this.cookies = data.cookies ?? {};
      this.accessToken = data.accessToken ?? null;
      this.accessTokenExpiresAt = data.accessTokenExpiresAt ?? null;
      return Object.keys(this.cookies).length > 0;
    } catch {
      return false;
    }
  }

  async persist() {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(
      this.filePath,
      JSON.stringify(
        {
          cookies: this.cookies,
          accessToken: this.accessToken,
          accessTokenExpiresAt: this.accessTokenExpiresAt,
        },
        null,
        2,
      ),
      'utf8',
    );
  }

  applyAuthResult(body, setCookies) {
    this.cookies = { ...this.cookies, ...setCookies };
    this.accessToken = body?.data?.accessToken ?? body?.accessToken;
    this.accessTokenExpiresAt = body?.data?.expiresAt ?? body?.expiresAt ?? null;
  }

  async freshLogin() {
    const { identifier, password, totp } = this.credentials;
    if (!identifier || !password) {
      throw new Error(
        `Thiếu identifier/password cho ${this.label} và không có session cũ để dùng lại.`,
      );
    }

    const response = await fetch(`${this.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', connection: 'close' },
      body: JSON.stringify({ identifier, password }),
    });
    const body = await readJsonBody(response);

    if (response.ok) {
      this.applyAuthResult(body, parseSetCookies(response));
      return;
    }

    const errorCode = body?.error?.code;
    if (errorCode !== 'AUTH_MFA_REQUIRED') {
      throw new Error(
        `Login ${this.label} thất bại (${response.status}): ${describeApiError(body)}`,
      );
    }

    if (!totp) {
      throw new Error(
        `Tài khoản ${this.label} yêu cầu mã MFA nhưng chưa cung cấp TOTP.`,
      );
    }

    const mfaTicket = body?.error?.details?.mfaTicket;
    const mfaResp = await fetch(`${this.baseUrl}/api/v1/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', connection: 'close' },
      body: JSON.stringify({ mfaTicket, totpCode: totp }),
    });
    const mfaBody = await readJsonBody(mfaResp);
    if (!mfaResp.ok) {
      throw new Error(
        `MFA verify ${this.label} thất bại (${mfaResp.status}): ${describeApiError(mfaBody)}`,
      );
    }
    this.applyAuthResult(mfaBody, parseSetCookies(mfaResp));
  }

  async refresh() {
    const csrfValue = findCsrfValue(this.cookies);
    const headers = {
      'content-type': 'application/json',
      connection: 'close',
      cookie: cookieHeaderFrom(this.cookies),
    };
    if (csrfValue) headers[CSRF_HEADER_NAME] = csrfValue;

    const response = await fetch(`${this.baseUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers,
    });
    const body = await readJsonBody(response);
    if (!response.ok) {
      throw new Error(
        `Refresh ${this.label} thất bại (${response.status}): ${describeApiError(body)}`,
      );
    }
    this.applyAuthResult(body, parseSetCookies(response));
  }

  isExpiringSoon() {
    if (!this.accessToken || !this.accessTokenExpiresAt) return true;
    return Date.now() >= new Date(this.accessTokenExpiresAt).getTime() - 90_000;
  }

  /** True once we have *some* usable state, without hitting the network. */
  hasCookies() {
    return Object.keys(this.cookies).length > 0;
  }

  /** Ensure a usable access token exists, refreshing or logging in as needed. */
  async ensureReady() {
    if (!this.hasCookies()) {
      await this.load();
    }

    if (!this.isExpiringSoon()) return;

    if (this.hasCookies()) {
      try {
        await this.refresh();
        await this.persist();
        this.onLog(`[${this.label}] refreshed access token (hết hạn ${this.accessTokenExpiresAt})`);
        return;
      } catch (err) {
        this.onLog(`[${this.label}] refresh thất bại (${err.message}), login lại từ đầu...`);
      }
    }

    await this.freshLogin();
    await this.persist();
    this.onLog(`[${this.label}] login mới (hết hạn ${this.accessTokenExpiresAt})`);
  }

  /** fetch wrapper: auto-refreshes before the call, retries once on a stray 401 TOKEN_EXPIRED. */
  async authFetch(pathName, options = {}) {
    await this.ensureReady();

    const doFetch = () =>
      fetch(`${this.baseUrl}${pathName}`, {
        ...options,
        headers: {
          ...(options.headers ?? {}),
          authorization: `Bearer ${this.accessToken}`,
          connection: 'close',
        },
      });

    let response = await doFetch();
    if (response.status === 401) {
      const body = await readJsonBody(response);
      if (body?.error?.code === 'TOKEN_EXPIRED') {
        this.onLog(`[${this.label}] access token expired giữa chừng, refresh & thử lại...`);
        this.accessTokenExpiresAt = null;
        await this.ensureReady();
        return doFetch();
      }
      return new Response(JSON.stringify(body), {
        status: response.status,
        headers: response.headers,
      });
    }
    return response;
  }
}
