import "server-only";

import { placeAffiliateLink } from "@/lib/affiliate";
import { getMetaConnection, getConnection } from "@/lib/connections";
import { logger, serializeError } from "@/lib/log";
import { getSetting, isWorkflowEnabled } from "@/lib/settings";
import { publishFacebook, publishInstagram, commentOnPost } from "@/lib/meta";
import { publishVideo as publishTikTokVideo, creatorInfo as tiktokCreatorInfo } from "@/lib/tiktok";
import { publishVideo as publishYouTubeVideo } from "@/lib/youtube";

const log = logger("publish");

export interface PublishJob {
  workspace_id: string;
  platform: string;
}

export interface PublishVariant {
  variant_body: string;
  hashtags: string[] | null;
  cta: string | null;
  media_url: string | null;
  // Product affiliate URL (products.url) threaded in by the callers. Placement
  // is per-platform: facebook → auto first comment, IG/TikTok/YouTube →
  // appended to the caption (see lib/affiliate.ts).
  affiliate_url?: string | null;
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
  // variant_body is typed as string but the DB column could hold null — never
  // let template interpolation publish the literal text "null".
  const body = variant.variant_body ?? "";
  const builtCaption = hashtagStr ? `${body}\n${hashtagStr}` : body;
  // Auto affiliate link: facebook keeps the caption clean and gets the link as
  // a first comment; IG/TikTok/YouTube get it appended to the caption.
  const { caption, firstComment } = placeAffiliateLink(
    builtCaption,
    variant.affiliate_url,
    job.platform
  );

  try {
    if (job.platform === "facebook") {
      const conn = await getMetaConnection(job.workspace_id, "facebook");
      if (!conn) return { error: "ยังไม่ได้เชื่อมบัญชี Facebook" };
      const pageId = String(conn.metadata.page_id ?? "");
      const postId = await publishFacebook(pageId, conn.token, caption, variant.cta);
      // The auto first comment can be turned off per workspace at
      // /settings/system (workflow_affiliate_comment).
      const commentEnabled =
        firstComment != null &&
        (await isWorkflowEnabled(job.workspace_id, "workflow_affiliate_comment"));
      if (firstComment && commentEnabled) {
        // Best-effort: the post already succeeded, so a failed affiliate
        // comment must not fail the publish (the creator can add it manually).
        try {
          await commentOnPost(postId, conn.token, firstComment);
        } catch (e) {
          // The comment is an enhancement, not part of the publish contract —
          // but leave a trace so API/permission/rate-limit issues are visible.
          log.warn("affiliate_comment_failed", { postId, error: serializeError(e) });
        }
      }
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
    if (job.platform === "tiktok") {
      const conn = await getConnection(job.workspace_id, "tiktok");
      if (!conn) return { error: "ยังไม่ได้เชื่อมบัญชี TikTok" };
      if (!variant.media_url) return { error: "TikTok ต้องมีวิดีโอ (media_url)" };
      // Direct Post REQUIRES privacy_level. Ask TikTok what the creator+app
      // combo is currently allowed to post as (unaudited apps typically get
      // SELF_ONLY only). Prefer the env-configured default if it's supported,
      // otherwise fall back to the first allowed value — never guess.
      const info = await tiktokCreatorInfo(conn.token);
      const allowed = info?.privacyLevelOptions ?? [];
      const preferred =
        (await getSetting(job.workspace_id, "tiktok_default_privacy_level")) ||
        "SELF_ONLY";
      const privacyLevel = allowed.includes(preferred) ? preferred : allowed[0];
      if (!privacyLevel) {
        return { error: "TikTok ไม่คืน privacy_level ที่ใช้ได้ — ตรวจ scope/สถานะแอป" };
      }
      const publishId = await publishTikTokVideo(
        conn.token,
        caption,
        variant.media_url,
        privacyLevel
      );
      return { publishedUrl: `tiktok:publish/${publishId}` };
    }
    if (job.platform === "youtube") {
      const conn = await getConnection(job.workspace_id, "youtube");
      if (!conn) return { error: "ยังไม่ได้เชื่อมบัญชี YouTube" };
      if (!variant.media_url) return { error: "YouTube ต้องมีวิดีโอ (media_url)" };
      // Default privacy is "private" (safest — surfaces on the creator's
      // studio but not to viewers). Overridable per workspace at
      // /settings/system or via env.
      const privacy = ((await getSetting(job.workspace_id, "youtube_default_privacy")) ||
        "private") as "private" | "unlisted" | "public";
      const videoId = await publishYouTubeVideo(conn.token, caption, variant.media_url, privacy);
      return { publishedUrl: `https://youtube.com/watch?v=${videoId}` };
    }
    return { error: "connector สำหรับแพลตฟอร์มนี้ยังไม่พร้อม (ใช้ copy-to-post)" };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "publish failed" };
  }
}
