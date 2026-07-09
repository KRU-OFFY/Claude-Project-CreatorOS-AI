import "server-only";

import { getMetaConnection } from "@/lib/connections";
import { publishFacebook, publishInstagram } from "@/lib/meta";

export interface PublishJob {
  workspace_id: string;
  platform: string;
}

export interface PublishVariant {
  variant_body: string;
  hashtags: string[] | null;
  cta: string | null;
  media_url: string | null;
}

export interface PublishOutcome {
  publishedUrl?: string;
  error?: string;
}

// Shared publish core used by the publishNow server action and the cron worker.
// Returns a published URL on success or a human-readable error (never throws).
export async function executePublish(
  job: PublishJob,
  variant: PublishVariant
): Promise<PublishOutcome> {
  const hashtagStr = (variant.hashtags ?? []).map((h) => `#${h}`).join(" ");
  const caption = hashtagStr ? `${variant.variant_body}\n${hashtagStr}` : variant.variant_body;

  try {
    if (job.platform === "facebook") {
      const conn = await getMetaConnection(job.workspace_id, "facebook");
      if (!conn) return { error: "ยังไม่ได้เชื่อมบัญชี Facebook" };
      const pageId = String(conn.metadata.page_id ?? "");
      const postId = await publishFacebook(pageId, conn.token, caption, variant.cta);
      return { publishedUrl: `https://facebook.com/${postId}` };
    }
    if (job.platform === "instagram") {
      const conn = await getMetaConnection(job.workspace_id, "instagram");
      if (!conn) return { error: "ยังไม่ได้เชื่อมบัญชี Instagram" };
      const igId = String(conn.metadata.ig_user_id ?? "");
      if (!variant.media_url) return { error: "Instagram ต้องมีรูปภาพ (media_url)" };
      const mediaId = await publishInstagram(igId, conn.token, caption, variant.media_url);
      return { publishedUrl: `https://instagram.com/p/${mediaId}` };
    }
    return { error: "connector สำหรับแพลตฟอร์มนี้ยังไม่พร้อม (ใช้ copy-to-post)" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "publish failed" };
  }
}
