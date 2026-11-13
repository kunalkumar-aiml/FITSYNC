import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const ok = <T>(data: T, status = 200) => NextResponse.json({ data }, { status });

export function handleError(e: unknown) {
  if (e instanceof ApiError) {
    const retry = (e.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds;
    return NextResponse.json({ error: { message: e.message, details: e.details } }, { status: e.status, headers: retry ? { "retry-after": String(retry) } : undefined });
  }
  if (e instanceof ZodError) {
    return NextResponse.json(
      { error: { message: "Please check the highlighted fields.", details: e.flatten().fieldErrors } },
      { status: 400 },
    );
  }
  // Log the error server-side only. The response never contains stack traces or internal messages.
  console.error("[api] unhandled error", e instanceof Error ? `${e.name}: ${e.message}` : "unknown");
  return NextResponse.json({ error: { message: "Something went wrong on our side. Please try again." } }, { status: 500 });
}

/** Wrap a route handler so thrown ApiErrors / ZodErrors become JSON responses. */
export function route<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      return handleError(e);
    }
  };
}

const MAX_JSON_BYTES = 256 * 1024;

/** Parse and validate a JSON body. Bodies over 256 KB are refused before parsing. */
export async function parseBody<S extends ZodTypeAny>(req: Request, schema: S, maxBytes = MAX_JSON_BYTES): Promise<z.infer<S>> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new ApiError(413, "Request is too large.");
  let text: string;
  try { text = await req.text(); } catch { throw new ApiError(400, "Could not read the request body."); }
  if (text.length > maxBytes) throw new ApiError(413, "Request is too large.");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ApiError(400, "Request body must be valid JSON.");
  }
  return schema.parse(json);
}
