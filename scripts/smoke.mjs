// Route + API smoke test. Runs against an already-running server (BASE_URL)
// and checks each route responds without a server error. In no-ENV (demo)
// mode, protected routes redirect to /setup — that's a pass (not a crash).
// Pass --json to print a machine-readable summary as the last line.
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const JSON_SUMMARY = process.argv.includes("--json");

let failed = 0;
const results = [];

function record(name, ok, detail) {
  if (!ok) failed++;
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name} → ${detail}`);
}

const routes = [
  "/api/health",
  "/",
  "/login",
  "/setup",
  "/dashboard",
  "/products",
  "/campaigns",
  "/content-studio",
  "/compliance",
  "/publish-center",
  "/calendar",
  "/analytics",
  "/revenue-forecast",
  "/ai-advisor",
  "/settings",
];

for (const r of routes) {
  try {
    const res = await fetch(BASE + r, { redirect: "manual" });
    record(r, res.status < 500, `${res.status}`);
  } catch (e) {
    record(r, false, `ERROR ${e.message}`);
  }
}

// /settings/team is a dash page like the ones above; in demo mode the dash
// layout redirects to /setup (307). With Supabase configured it may render at
// 200 (authenticated) or redirect to /login (307), so accept both statuses.
{
  const res = await fetch(BASE + "/settings/team", { redirect: "manual" });
  const allowed = [200, 307];
  record(
    "/settings/team (no crash)",
    allowed.includes(res.status),
    `${res.status} (expect one of ${allowed.join("/")})`
  );
}

// /invite/<token> must never crash. In demo mode createAdminClient() returns
// null and the page redirect()s to /setup → observed 307. (With Supabase
// configured, an unknown token renders the "invalid invite" view at 200.)
{
  const res = await fetch(BASE + "/invite/sometoken", { redirect: "manual" });
  const allowed = [200, 307];
  record(
    "/invite/sometoken (no crash)",
    allowed.includes(res.status),
    `${res.status} (expect one of ${allowed.join("/")})`
  );
}

// Cron routes must reject unauthenticated requests (401) — never open.
for (const c of ["/api/cron/publish", "/api/cron/ingest", "/api/cron/refresh-tokens"]) {
  const res = await fetch(BASE + c, { redirect: "manual" });
  record(`${c} (no auth)`, res.status === 401, `${res.status} (expect 401)`);
}

// Health must be a real 200 with ok:true and every config flag present as a
// boolean under `checks` (key list mirrors app/api/health/route.ts).
{
  const res = await fetch(BASE + "/api/health");
  const health = await res.json().catch(() => null);
  const expectedFlags = [
    "supabase_configured",
    "ai_configured",
    "render_worker_configured",
    "cron_secret_configured",
    "sentry_configured",
    "resend_configured",
    "meta_connector_configured",
    "tiktok_connector_configured",
  ];
  const missing = expectedFlags.filter((k) => typeof health?.checks?.[k] !== "boolean");
  if (typeof health?.ok !== "boolean") missing.push("ok");
  const ok = res.status === 200 && health?.ok === true && missing.length === 0;
  record(
    "/api/health (keys)",
    ok,
    ok
      ? `200 ok=true, all keys present ${JSON.stringify(health.checks)}`
      : `${res.status} ok=${health?.ok} missing=[${missing.join(", ")}]`
  );
}

// Render worker callback. An empty/invalid body fails field validation before
// any HMAC work → 400 (this is the demo-mode behavior too: the body check
// runs first, so no secret is ever consulted for a malformed payload).
{
  const res = await fetch(BASE + "/api/render/callback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  record("/api/render/callback (empty body)", res.status === 400, `${res.status} (expect 400)`);
}

// A structurally valid but unsigned payload reaches verifyCallbackAuth; with
// RENDER_WORKER_SECRET unset (demo mode) signature verification fails closed,
// so the route returns 401 — never 500, never accepted.
{
  const res = await fetch(BASE + "/api/render/callback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jobId: "smoke-job",
      nonce: "smoke-nonce",
      ts: Math.floor(Date.now() / 1000),
      signature: "deadbeef",
    }),
  });
  record("/api/render/callback (bad signature)", res.status === 401, `${res.status} (expect 401)`);
}

console.log(failed === 0 ? "\nALL SMOKE TESTS PASSED" : `\n${failed} FAILED`);
if (JSON_SUMMARY) {
  console.log(JSON.stringify({ ok: failed === 0, total: results.length, failed, results }));
}
process.exit(failed === 0 ? 0 : 1);
