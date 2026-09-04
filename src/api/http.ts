// Every request goes through this app's own origin.
//
// Neither platform sends `Access-Control-Allow-Origin` for anyone but its own
// website — Snapp Market echoes only `https://snapp.market`, Digikala Jet sends
// nothing at all — so a browser will not let a page on another origin read the
// response. The app is therefore served together with a small pass-through
// proxy at `/api/snapp` and `/api/jet` (see `server/index.mjs`, and the dev
// proxy in `vite.config.ts`), which makes every call same-origin.

export const SNAPP_BASE = '/api/snapp';
export const JET_BASE = '/api/jet';
export const OKALA_BASE = '/api/okala';

export class ApiError extends Error {
  readonly status: number;
  readonly retryAfter: number | null;

  constructor(message: string, options: { status?: number; retryAfter?: number | null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status ?? 0;
    this.retryAfter = options.retryAfter ?? null;
  }
}

export class NotSignedInError extends Error {
  readonly notSignedIn = true;

  constructor(message = 'برای این کار باید وارد حسابت باشی') {
    super(message);
    this.name = 'NotSignedInError';
  }
}

export function retryAfterSeconds(response: Response): number | null {
  const header = response.headers.get('retry-after');
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds;
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(Math.ceil((date - Date.now()) / 1000), 0) : null;
}

export interface RequestOptions {
  method?: 'GET' | 'POST';
  query?: Record<string, string | number | undefined>;
  /** Extra headers the platform's gateway insists on. */
  headers?: Record<string, string>;
  body?: unknown;
  form?: URLSearchParams;
  token?: string | null;
  /** Snapp sends `Bearer <jwt>`; Jet sends the token bare. */
  tokenScheme?: 'bearer' | 'raw';
  signal?: AbortSignal;
}

export async function request<T>(
  base: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  }

  const headers: Record<string, string> = {
    accept: 'application/json, text/plain, */*',
    ...options.headers,
  };
  if (options.token) {
    headers.authorization =
      options.tokenScheme === 'raw' ? options.token : `Bearer ${options.token}`;
  }

  let body: BodyInit | undefined;
  if (options.form) {
    headers['content-type'] = 'application/x-www-form-urlencoded';
    body = options.form.toString();
  } else if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const suffix = query.toString();
  const response = await fetch(`${base}${path}${suffix ? `?${suffix}` : ''}`, {
    method: options.method ?? 'GET',
    headers,
    body,
    signal: options.signal,
  });

  if (response.status === 429) {
    throw new ApiError('سرویس فعلاً درخواست بیشتری قبول نمی‌کند', {
      status: 429,
      retryAfter: retryAfterSeconds(response),
    });
  }

  const json = (await response.json().catch(() => null)) as T & {
    message?: string;
    status?: unknown;
  };

  if (!response.ok) {
    throw new ApiError(json?.message || `${path} → ${response.status}`, {
      status: response.status,
    });
  }
  return json;
}
