// Every request goes through a proxy this project controls.
//
// None of the three platforms sends `Access-Control-Allow-Origin` on a real
// response for any origin but its own website — measured, not assumed: Snapp
// Market echoes only `https://snapp.market`, Digikala Jet sends nothing, and
// Okala answers the preflight permissively but omits the header from the
// response itself, which a browser treats as a refusal all the same. So no
// amount of client-side code can call them from a page on another origin.
//
// `VITE_API_BASE` says where that proxy lives:
//
//   unset            `/api` — same origin, which is what `npm start` and the
//                    Docker image serve, and what the dev server proxies.
//   an absolute URL  a proxy on another origin, for a static host such as
//                    GitHub Pages. It has to allow this app's origin back.
//
// See docs/HOSTING.md.
const API_BASE = (import.meta.env.VITE_API_BASE ?? '/api').replace(/\/$/, '');

export const SNAPP_BASE = `${API_BASE}/snapp`;
export const JET_BASE = `${API_BASE}/jet`;
export const OKALA_BASE = `${API_BASE}/okala`;

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

  const json = (await response.json().catch(() => null)) as
    (T & { message?: string; status?: unknown }) | null;

  // A static host with no proxy behind `/api` answers with its own 404 page, and
  // the parse above fails on the HTML with something unreadable. Say what
  // actually went wrong instead of passing that on.
  if (json === null) {
    throw new ApiError(
      `پروکسی در ${API_BASE} پاسخ درستی نداد. اگر برنامه روی میزبان استاتیک بالاست، ` +
        'باید VITE_API_BASE به یک پروکسی اشاره کند — docs/HOSTING.md',
      { status: response.status },
    );
  }

  if (!response.ok) {
    throw new ApiError(json?.message || `${path} → ${response.status}`, {
      status: response.status,
    });
  }
  return json;
}
