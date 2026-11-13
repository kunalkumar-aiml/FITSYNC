import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { ConfigError } from "./errors";
export { ConfigError };

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const ok = <T>(data: T, status = 200) => NextResponse.json({ data }, { status });

export type ErrorKind = "config" | "db_unreachable" | "db_schema" | "conflict" | "unknown";

/**
 * Classify an unexpected error so the user gets an honest message instead of one generic sentence for everything.
 * Prisma codes: P1001/P1002/P1008/P1017 connection problems, P2021 table missing, P2022 column missing, P2002 unique clash.
 */
export function errorKind(e: unknown): ErrorKind {
  if (e instanceof ConfigError) return "config";
  const code = (e as { code?: unknown } | null)?.code;
  const msg = e instanceof Error ? `${e.message} ${String((e as { cause?: unknown }).cause ?? "")}` : "";
  if (code === "P2002") return "conflict";
  if (code === "P2021" || code === "P2022" || /does not exist in the current database|relation .* does not exist|column .* does not exist/i.test(msg)) return "db_schema";
  if (["P1001", "P1002", "P1008", "P1017"].includes(String(code)) || /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|Can't reach database|DatabaseNotReachable|Connection terminated|too many clients/i.test(msg)) return "db_unreachable";
  return "unknown";
}

const SERVICE_MESSAGES: Record<Exclude<ErrorKind, "conflict" | "unknown">, string> = {
  config: "FITSYNC is temporarily unavailable because of a server configuration problem. Please try again later.",
  db_unreachable: "FITSYNC can’t reach its database right now. Please try again in a few minutes.",
  db_schema: "FITSYNC is finishing an update. Please try again in a few minutes.",
};

const reference = () => Math.random().toString(36).slice(2, 8).toUpperCase();

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
  // Log server-side only, with a short reference the user can quote. Responses never contain stack traces,
  // SQL, connection strings or internal messages.
  const kind = errorKind(e);
  const ref = reference();
  const code = (e as { code?: unknown } | null)?.code;
  console.error(`[api] ${kind} error ref=${ref}`, e instanceof Error ? `${e.name}${code ? ` ${String(code)}` : ""}: ${e.message}` : "unknown");
  if (kind === "conflict") {
    return NextResponse.json({ error: { message: "That change clashed with another one made at the same moment. Please try again.", details: { ref } } }, { status: 409 });
  }
  if (kind !== "unknown") {
    return NextResponse.json({ error: { message: SERVICE_MESSAGES[kind], details: { code: kind.toUpperCase(), ref } } }, { status: 503, headers: { "retry-after": "60" } });
  }
  return NextResponse.json({ error: { message: `Something went wrong on our side. Please try again. (Reference ${ref})`, details: { ref } } }, { status: 500 });
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
