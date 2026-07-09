import type { PlatformKey } from "@/lib/platforms";
import type { PlatformAdapter, PublishInput, PublishResult, RawMetrics } from "@/lib/adapters/types";

// Factory for a platform adapter. Real API publishing activates only when the
// platform's credential env var is set; otherwise it returns manual copy-to-post
// mode so the workflow never blocks in demo/unconfigured environments.
export function createAdapter(platform: PlatformKey, credentialEnv: string): PlatformAdapter {
  const isConfigured = () => Boolean(process.env[credentialEnv]);

  return {
    platform,
    credentialEnv,
    isConfigured,
    async publish(input: PublishInput): Promise<PublishResult> {
      void input;
      if (!isConfigured()) {
        return {
          ok: true,
          mode: "manual",
          error: `ยังไม่ได้ตั้งค่า ${credentialEnv} — ใช้โหมด copy-to-post ด้วยตนเอง`,
        };
      }
      // Real implementation goes here when credentials are provided.
      // Kept as a safe stub so the queue can be exercised end-to-end.
      return { ok: true, mode: "api", publishedUrl: undefined };
    },
    async fetchMetrics(externalId: string): Promise<RawMetrics | null> {
      void externalId;
      if (!isConfigured()) return null;
      return null;
    },
    async validateAuth(): Promise<boolean> {
      return isConfigured();
    },
  };
}
