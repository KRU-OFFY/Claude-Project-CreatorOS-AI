import { createAdapter } from "@/lib/adapters/base";
// Lemon8 has no public publishing API — manual copy-to-post only.
export const lemon8 = createAdapter("lemon8", "LEMON8_ACCESS_TOKEN");
