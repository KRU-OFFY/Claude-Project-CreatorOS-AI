import "server-only";

// Small structured logger. Emits JSON to stderr so Vercel / any log-shipper
// can index by `level` / `service` / `event`. Kept dep-free on purpose —
// the goal is "know when cron dies at 3am", not full observability platform.
//
// LEVEL is env-configurable; default "info" in production, "debug" locally.

type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

// Cache the effective level at module-eval time. `process.env` reads cross
// the JS/C++ boundary in Node, so re-reading on every emit is measurable
// overhead when logs are hot (cron loops, per-row iterations). Tests use
// `vi.resetModules()` to re-import with different LOG_LEVEL values, so
// caching aligns with the test model too.
const CURRENT_LEVEL: number = (() => {
  const v = (process.env.LOG_LEVEL ?? "").toLowerCase() as Level;
  if (v && LEVELS[v] !== undefined) return LEVELS[v];
  return process.env.NODE_ENV === "production" ? LEVELS.info : LEVELS.debug;
})();

interface LogRecord {
  ts: string;
  level: Level;
  service: string;
  event: string;
  msg?: string;
  duration_ms?: number;
  error?: { name: string; message: string; stack?: string };
  [k: string]: unknown;
}

function emit(rec: LogRecord): void {
  if (LEVELS[rec.level] < CURRENT_LEVEL) return;
  try {
    process.stderr.write(JSON.stringify(rec) + "\n");
  } catch {
    // A logger must never crash the caller.
  }
}

export interface Logger {
  debug(event: string, ctx?: Record<string, unknown>): void;
  info(event: string, ctx?: Record<string, unknown>): void;
  warn(event: string, ctx?: Record<string, unknown>): void;
  error(event: string, ctx?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

function make(service: string, bindings: Record<string, unknown> = {}): Logger {
  function log(level: Level, event: string, ctx?: Record<string, unknown>) {
    emit({
      ts: new Date().toISOString(),
      level,
      service,
      event,
      ...bindings,
      ...(ctx ?? {}),
    });
  }
  return {
    debug: (e, c) => log("debug", e, c),
    info: (e, c) => log("info", e, c),
    warn: (e, c) => log("warn", e, c),
    error: (e, c) => log("error", e, c),
    child: (b) => make(service, { ...bindings, ...b }),
  };
}

export function logger(service: string, bindings: Record<string, unknown> = {}): Logger {
  return make(service, bindings);
}

// Turn any thrown value into a serializable snapshot for the `error` field.
export function serializeError(e: unknown): {
  name: string;
  message: string;
  stack?: string;
} {
  if (e instanceof Error) {
    return { name: e.name, message: e.message, stack: e.stack };
  }
  return { name: "unknown", message: String(e) };
}

// Best-effort ping to Sentry. No dependency required — the SDK is loaded
// dynamically only if SENTRY_DSN is set at runtime, so bundlers don't pull
// it into deployments that don't use it. If the import fails (SDK not
// installed), we silently degrade to console-only.
let sentryClient: unknown = null;
let sentryTried = false;
async function trySentry() {
  if (sentryTried || !process.env.SENTRY_DSN) return null;
  sentryTried = true;
  try {
    // Optional dep — declared dynamic so TS/bundlers don't require it at
    // build time. Deployments without Sentry don't need to install it.
    // @ts-expect-error — @sentry/node is optional at runtime
    const mod = (await import("@sentry/node").catch(() => null)) as {
      init?: (opts: { dsn: string; tracesSampleRate?: number }) => void;
      captureException?: (e: unknown) => void;
      flush?: (timeout?: number) => Promise<boolean>;
    } | null;
    if (!mod?.init || !mod.captureException) return null;
    mod.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0 });
    sentryClient = mod;
    return mod;
  } catch {
    return null;
  }
}

export async function reportError(e: unknown): Promise<void> {
  const mod = (sentryClient ?? (await trySentry())) as {
    captureException?: (e: unknown) => void;
    flush?: (timeout?: number) => Promise<boolean>;
  } | null;
  if (mod?.captureException) {
    try {
      mod.captureException(e);
      // Vercel / other serverless runtimes freeze the container as soon as
      // the response returns. Sentry's queue is async — without flush the
      // event may never leave the box. 2s bound keeps the boundary fast
      // even when Sentry is slow / unreachable.
      if (mod.flush) await mod.flush(2000);
    } catch {
      // Sentry itself failed — nothing more to do.
    }
  }
}
