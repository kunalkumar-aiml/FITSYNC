export class ClientError extends Error {
  constructor(message: string, public status: number, public details?: Record<string, string[]> & { errors?: string[] }) {
    super(message);
  }
}

/** Fetch JSON from our API, unwrapping { data } and throwing a readable error. */
export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...rest.headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  let payload: { data?: T; error?: { message: string; details?: never } } = {};
  try { payload = await res.json(); } catch { /* non-JSON error */ }
  if (!res.ok) throw new ClientError(payload.error?.message ?? "Something went wrong. Please try again.", res.status, payload.error?.details);
  return payload.data as T;
}
