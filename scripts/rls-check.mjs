#!/usr/bin/env node
// Lint supabase/migrations/*.sql to enforce our RLS invariants:
//   - every business table (auto-discovered from `create table` statements
//     and not in the ALLOWLIST) must have RLS enabled AND at least one policy
//   - channel_connections must revoke `select` from anon+authenticated
//   - the encrypted-token columns must NOT appear in the column-scoped grant
//     to authenticated
//
// This runs in CI (see .github/workflows/ci.yml) so a migration that adds a
// new business table without RLS trips a review requirement before it ever
// reaches production. The check auto-discovers tables so new features don't
// need to update this script — only rare exceptions do.
//
// Dep-free (Node stdlib only) so it works on a bare CI runner.

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const MIGRATIONS = "supabase/migrations";

// Tables that intentionally don't follow the "member read + writer write"
// pattern. They still have RLS enabled with their own policies — the check
// below only skips the auto-discovery membership requirement. If you add
// an entry here, document why in the migration.
const ALLOWLIST = new Set([
  "profiles", // per-user rows (own-id read/update, not workspace-scoped)
  "workspaces", // membership + owner rules
  "workspace_members", // membership meta
]);

async function loadAll() {
  const files = (await readdir(MIGRATIONS)).filter((f) => f.endsWith(".sql")).sort();
  const parts = await Promise.all(
    files.map(async (f) => `-- ${f}\n${await readFile(join(MIGRATIONS, f), "utf8")}`)
  );
  return parts.join("\n");
}

function fail(msg) {
  console.error(`RLS check FAILED: ${msg}`);
  process.exitCode = 1;
}

const sql = await loadAll();

// Discover every table declared by the migrations. Optionally accepts a
// double- or single-quoted identifier so standard SQL formatting
// (`create table "foo" (`) still counts.
const discovered = new Set();
for (const m of sql.matchAll(
  /create\s+table\s+(?:if\s+not\s+exists\s+)?["']?([a-z_][a-z0-9_]*)["']?/gi
)) {
  discovered.add(m[1].toLowerCase());
}

const required = [...discovered].filter((t) => !ALLOWLIST.has(t));

for (const table of required) {
  // 0009 turns on RLS for all business tables via a do-block loop. Accept
  // either an inline `alter table <t> enable row level security` (with or
  // without double-quotes around the identifier) or the loop with the
  // table name inside the array literal.
  const inlineEnable = new RegExp(
    `alter\\s+table\\s+"?${table}"?\\s+enable\\s+row\\s+level\\s+security`,
    "i"
  );
  const loopEnable = new RegExp(`array\\s*\\[[^\\]]*'${table}'[^\\]]*\\]`, "is");
  if (!inlineEnable.test(sql) && !loopEnable.test(sql)) {
    fail(`no RLS enabled for '${table}'`);
    continue;
  }

  const inlinePolicy = new RegExp(
    `create\\s+policy\\s+[^;]+\\s+on\\s+"?${table}"?`,
    "i"
  );
  if (!inlinePolicy.test(sql) && !loopEnable.test(sql)) {
    fail(`no policy on '${table}'`);
  }
}

// Token protection: channel_connections must revoke default select from
// anon/authenticated so tokens are only accessible via the admin client.
if (
  !/revoke\s+select\s+on\s+"?channel_connections"?\s+from\s+anon\s*,\s*authenticated/i.test(sql)
) {
  fail("channel_connections does not revoke SELECT from anon/authenticated");
}

// And the encrypted-token columns must NOT appear in ANY column-scoped
// grant to `authenticated`. Scan every match — a later migration adding
// `grant select (access_token_encrypted) on channel_connections to
// authenticated` would silently slip past a single `.match()` that only
// looks at the first (safe) grant from 0009.
const tokenGrants = sql.matchAll(
  /grant\s+select\s*\(([^)]+)\)\s+on\s+"?channel_connections"?\s+to\s+authenticated/gi
);
for (const tokenGrant of tokenGrants) {
  const cols = tokenGrant[1].toLowerCase();
  for (const forbidden of ["access_token_encrypted", "refresh_token_encrypted"]) {
    if (cols.includes(forbidden)) {
      fail(
        `channel_connections grants ${forbidden} to authenticated — encrypted tokens must stay server-only`
      );
    }
  }
}

if (process.exitCode === 1) {
  console.error("");
  console.error("Fix the migration or (rare) add the table to ALLOWLIST with a comment.");
  process.exit(1);
}

console.log(
  `RLS check OK — ${required.length} tables scanned, all have RLS + policies; ${ALLOWLIST.size} allowlisted; token columns protected.`
);
