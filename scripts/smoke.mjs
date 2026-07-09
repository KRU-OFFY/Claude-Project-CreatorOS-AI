// Route + API smoke test. Starts against a running server (BASE_URL) and checks
// each route responds without a server error. In no-ENV mode, protected routes
// redirect to /setup — that's a pass (not a crash).
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

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

let failed = 0;
for (const r of routes) {
  try {
    const res = await fetch(BASE + r, { redirect: "manual" });
    const ok = res.status < 500;
    if (!ok) failed++;
    console.log(`${ok ? "✓" : "✗"} ${r} → ${res.status}`);
  } catch (e) {
    failed++;
    console.log(`✗ ${r} → ERROR ${e.message}`);
  }
}

// Cron routes must reject unauthenticated requests (401) — never open.
for (const c of ["/api/cron/publish", "/api/cron/ingest", "/api/cron/refresh-tokens"]) {
  const res = await fetch(BASE + c, { redirect: "manual" });
  const ok = res.status === 401;
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${c} (no auth) → ${res.status} (expect 401)`);
}

// Health must be a real 200 with ok:true.
const health = await fetch(BASE + "/api/health").then((r) => r.json());
console.log("health.ok =", health.ok, JSON.stringify(health.checks));
if (health.ok !== true) failed++;

console.log(failed === 0 ? "\nALL SMOKE TESTS PASSED" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
