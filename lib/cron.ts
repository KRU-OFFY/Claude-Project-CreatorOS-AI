import "server-only";

import { NextResponse } from "next/server";
import { logger, serializeError, reportError } from "@/lib/log";

// Authorize a cron request. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`
// when CRON_SECRET is configured. Any other scheduler can send the same header.
// If CRON_SECRET is unset, cron routes are disabled (returns false) to avoid an
// open endpoint.
export function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

// Shared error boundary for cron handlers. Logs start/end with duration,
// catches unhandled errors and reports them (Sentry when configured, always
// stderr). Returns a JSON 500 with a stable shape so the scheduler shows
// something actionable in the run summary.
export function withCronBoundary(
  route: string,
  handler: (request: Request) => Promise<Response>
): (request: Request) => Promise<Response> {
  const log = logger("cron", { route });
  return async (request: Request): Promise<Response> => {
    const started = Date.now();
    log.info("cron.start");
    try {
      const res = await handler(request);
      const duration_ms = Date.now() - started;
      log.info("cron.done", { duration_ms, status: res.status });
      return res;
    } catch (e) {
      const duration_ms = Date.now() - started;
      log.error("cron.error", { duration_ms, error: serializeError(e) });
      await reportError(e);
      return NextResponse.json(
        { ok: false, error: "internal_error" },
        { status: 500 }
      );
    }
  };
}
