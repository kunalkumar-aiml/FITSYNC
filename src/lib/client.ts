export class ClientError extends Error {
  constructor(message: string, public status: number, public details?: Record<string, string[]> & { errors?: string[]; code?: string }) {
    super(message);
  }
}

/** Reads the double-submit CSRF cookie (its name depends on whether the site runs over https). */
export function csrfToken(): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/(?:^|;\s*)(?:__Host-)?fitsync_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

async function ensureCsrf(): Promise<string> {
  let t = csrfToken();
  if (!t) { await fetch("/api/auth/csrf", { credentials: "same-origin" }).catch(() => null); t = csrfToken(); }
  return t;
}

/** Fetch JSON from our API, unwrapping { data } and throwing a readable error. Adds the CSRF header to mutations. */
export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const method = (rest.method ?? "GET").toUpperCase();
  const mutating = !["GET", "HEAD", "OPTIONS"].includes(method);
  const res = await fetch(url, {
    ...rest,
    credentials: "same-origin",
    headers: {
      ...(json !== undefined ? { "content-type": "application/json" } : {}),
      ...(mutating ? { "x-csrf-token": await ensureCsrf() } : {}),
      ...rest.headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  let payload: { data?: T; error?: { message: string; details?: never } } = {};
  try { payload = await res.json(); } catch { /* non-JSON error */ }
  if (!res.ok) {
    if (res.status === 401 && (payload.error?.details as { code?: string } | undefined)?.code === "SESSION_EXPIRED" && typeof window !== "undefined") {
      window.location.href = `/login?expired=1&next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw new ClientError(payload.error?.message ?? "Something went wrong. Please try again.", res.status, payload.error?.details);
  }
  return payload.data as T;
}
