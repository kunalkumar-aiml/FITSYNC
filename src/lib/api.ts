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
    return NextResponse.json({ error: { message: e.message, details: e.details } }, { status: e.status });
  }
  if (e instanceof ZodError) {
    return NextResponse.json(
      { error: { message: "Please check the highlighted fields.", details: e.flatten().fieldErrors } },
      { status: 400 },
    );
  }
  console.error("[api] unhandled error", e);
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

export async function parseBody<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError(400, "Request body must be valid JSON.");
  }
  return schema.parse(json);
}
