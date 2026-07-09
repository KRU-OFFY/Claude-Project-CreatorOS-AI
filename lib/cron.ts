import "server-only";

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
