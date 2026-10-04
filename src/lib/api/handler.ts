import "server-only";
import { z } from "zod";
import { getUserId } from "@/lib/supabase/auth";

/** An error with an HTTP status and a message that is safe to show players. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError)
    return Response.json({ error: "Invalid request" }, { status: 400 });
  console.error(error);
  return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

/** Parses a JSON body against a schema; throws a 400 ApiError if it doesn't fit. */
export async function readJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "Invalid request");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiError(400, "Invalid request");
  return parsed.data;
}

export async function requireUserId(): Promise<string> {
  const userId = await getUserId();
  if (!userId) throw new ApiError(401, "Please sign in first.");
  return userId;
}
