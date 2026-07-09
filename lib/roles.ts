// Compliance approval gate (Brief 2.1): only owner/approver may approve.
const APPROVER_ROLES = ["owner", "approver"];

export function canApprove(role: string): boolean {
  return APPROVER_ROLES.includes(role);
}
