import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextResponse } from "next/server";
import { authorizeCron, withCronBoundary } from "@/lib/cron";

describe("authorizeCron", () => {
  const oldSecret = process.env.CRON_SECRET;
  afterEach(() => {
    if (oldSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = oldSecret;
  });

  it("accepts the correct bearer token", () => {
    process.env.CRON_SECRET = "s3cret";
    const req = new Request("https://x.test", {
      headers: { authorization: "Bearer s3cret" },
    });
    expect(authorizeCron(req)).toBe(true);
  });

  it("rejects a missing header", () => {
    process.env.CRON_SECRET = "s3cret";
    expect(authorizeCron(new Request("https://x.test"))).toBe(false);
  });

  it("rejects the wrong secret", () => {
    process.env.CRON_SECRET = "s3cret";
    const req = new Request("https://x.test", {
      headers: { authorization: "Bearer wrong" },
    });
    expect(authorizeCron(req)).toBe(false);
  });

  it("rejects when CRON_SECRET is unset (fail closed)", () => {
    delete process.env.CRON_SECRET;
    const req = new Request("https://x.test", {
      headers: { authorization: "Bearer anything" },
    });
    expect(authorizeCron(req)).toBe(false);
  });
});

describe("withCronBoundary", () => {
  let stderr: ReturnType<typeof vi.fn>;
  let originalWrite: typeof process.stderr.write;
  beforeEach(() => {
    stderr = vi.fn(() => true);
    originalWrite = process.stderr.write;
    process.stderr.write = stderr as unknown as typeof process.stderr.write;
  });
  afterEach(() => {
    process.stderr.write = originalWrite;
  });

  it("passes through the handler's Response and logs done", async () => {
    const wrapped = withCronBoundary("test", async () =>
      NextResponse.json({ ok: true, jobs: 2 })
    );
    const res = await wrapped(new Request("https://x.test"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, jobs: 2 });
    const events = stderr.mock.calls
      .map((c) => JSON.parse((c[0] as string).trim()).event as string);
    expect(events).toContain("cron.start");
    expect(events).toContain("cron.done");
  });

  it("returns 500 and logs cron.error when the handler throws", async () => {
    const wrapped = withCronBoundary("boom", async () => {
      throw new Error("nope");
    });
    const res = await wrapped(new Request("https://x.test"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    const rec = stderr.mock.calls
      .map((c) => JSON.parse((c[0] as string).trim()))
      .find((r) => r.event === "cron.error");
    expect(rec).toBeDefined();
    expect(rec!.error.message).toBe("nope");
    expect(typeof rec!.duration_ms).toBe("number");
  });

  it("does not leak error details to the client", async () => {
    const wrapped = withCronBoundary("boom", async () => {
      throw new Error("db password: 12345");
    });
    const res = await wrapped(new Request("https://x.test"));
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain("password");
    expect(JSON.stringify(body)).not.toContain("12345");
  });
});
