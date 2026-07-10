import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Grab the logger fresh in each test because it reads env at module-eval time
// and we want to exercise level filtering with different LOG_LEVEL values.

async function fresh() {
  vi.resetModules();
  return await import("@/lib/log");
}

describe("logger", () => {
  // `process.stderr.write` has an overloaded signature that fights vi.spyOn's
  // generic — use a plain vi.fn() and swap it in so the test surface stays
  // typed while assertions read `stderr.mock.calls` normally.
  let stderr: ReturnType<typeof vi.fn>;
  let originalWrite: typeof process.stderr.write;

  beforeEach(() => {
    stderr = vi.fn(() => true);
    originalWrite = process.stderr.write;
    process.stderr.write = stderr as unknown as typeof process.stderr.write;
  });
  afterEach(() => {
    process.stderr.write = originalWrite;
    delete process.env.LOG_LEVEL;
  });

  it("emits JSON with service + event + custom bindings", async () => {
    process.env.LOG_LEVEL = "debug";
    const { logger } = await fresh();
    const log = logger("worker", { region: "th" });
    log.info("started", { job: "publish" });

    expect(stderr).toHaveBeenCalledTimes(1);
    const line = (stderr.mock.calls[0]![0] as string).trim();
    const rec = JSON.parse(line);
    expect(rec.service).toBe("worker");
    expect(rec.event).toBe("started");
    expect(rec.level).toBe("info");
    expect(rec.region).toBe("th");
    expect(rec.job).toBe("publish");
    expect(rec.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("filters by LOG_LEVEL", async () => {
    process.env.LOG_LEVEL = "warn";
    const { logger } = await fresh();
    const log = logger("worker");
    log.debug("skip1");
    log.info("skip2");
    log.warn("emit1");
    log.error("emit2");
    expect(stderr).toHaveBeenCalledTimes(2);
  });

  it("child(bindings) merges parent + child + call-site fields", async () => {
    process.env.LOG_LEVEL = "debug";
    const { logger } = await fresh();
    const base = logger("worker", { a: 1 });
    const child = base.child({ b: 2 });
    child.info("evt", { c: 3 });
    const rec = JSON.parse((stderr.mock.calls[0]![0] as string).trim());
    expect(rec.a).toBe(1);
    expect(rec.b).toBe(2);
    expect(rec.c).toBe(3);
  });

  it("serializeError extracts name/message/stack", async () => {
    const { serializeError } = await fresh();
    const e = new Error("boom");
    const s = serializeError(e);
    expect(s.name).toBe("Error");
    expect(s.message).toBe("boom");
    expect(typeof s.stack).toBe("string");
  });

  it("serializeError handles non-Error throws", async () => {
    const { serializeError } = await fresh();
    expect(serializeError("nope")).toEqual({ name: "unknown", message: "nope" });
    expect(serializeError(42)).toEqual({ name: "unknown", message: "42" });
  });

  it("logger never throws even if stderr write fails", async () => {
    stderr.mockImplementation(() => {
      throw new Error("pipe closed");
    });
    // Re-swap so the fresh module picks up the throwing impl.
    process.stderr.write = stderr as unknown as typeof process.stderr.write;
    process.env.LOG_LEVEL = "debug";
    const { logger } = await fresh();
    expect(() => logger("worker").error("boom")).not.toThrow();
  });
});
