import "server-only";

// TikTok connector — OAuth v2 + Content Posting API.
// Real publishing activates when TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET are
// set and a workspace has connected an account (OAuth in app/api/connect/tiktok/*).
//
// Note: TikTok requires a video. Direct Post to a public feed additionally
// requires an audited app; unaudited apps post to the creator's drafts/private.

const AUTH = "https://www.tiktok.com/v2/auth/authorize/";
const API = "https://open.tiktokapis.com/v2";

// user.info.basic to read the creator; video.publish/upload to post.
const SCOPES = ["user.info.basic", "video.publish", "video.upload"].join(",");

export function tiktokConfigured(): boolean {
  return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);
}

export function tiktokRedirectUri(origin: string): string {
  return process.env.TIKTOK_REDIRECT_URI || `${origin}/api/connect/tiktok/callback`;
}

export function authUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY ?? "",
    scope: SCOPES,
    response_type: "code",
    redirect_uri: tiktokRedirectUri(origin),
    state,
  });
  return `${AUTH}?${params.toString()}`;
}

export interface TikTokToken {
  token: string;
  refreshToken: string | null;
  openId: string;
  expiresAt: string | null;
}

async function postForm<T>(url: string, body: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json.error_description ?? json.error?.message ?? `TikTok ${url} failed`);
  }
  return json as T;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  open_id: string;
  expires_in?: number;
}

function toToken(r: TokenResponse): TikTokToken {
  return {
    token: r.access_token,
    refreshToken: r.refresh_token ?? null,
    openId: r.open_id,
    expiresAt:
      typeof r.expires_in === "number"
        ? new Date(Date.now() + r.expires_in * 1000).toISOString()
        : null,
  };
}

export async function exchangeCode(origin: string, code: string): Promise<TikTokToken> {
  const r = await postForm<TokenResponse>(`${API}/oauth/token/`, {
    client_key: process.env.TIKTOK_CLIENT_KEY ?? "",
    client_secret: process.env.TIKTOK_CLIENT_SECRET ?? "",
    code,
    grant_type: "authorization_code",
    redirect_uri: tiktokRedirectUri(origin),
  });
  return toToken(r);
}

export async function refreshAccessToken(refreshToken: string): Promise<TikTokToken> {
  const r = await postForm<TokenResponse>(`${API}/oauth/token/`, {
    client_key: process.env.TIKTOK_CLIENT_KEY ?? "",
    client_secret: process.env.TIKTOK_CLIENT_SECRET ?? "",
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  return toToken(r);
}

async function postJson<T>(path: string, token: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}/${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json.error?.code === undefined || json.error?.code !== "ok") {
    const msg = json.error?.message || `TikTok ${path} failed`;
    if (json.error && json.error.code !== "ok") throw new Error(msg);
  }
  return json as T;
}

// Validate the token by querying creator info (also confirms posting eligibility).
export async function creatorInfo(token: string): Promise<{ nickname?: string } | null> {
  try {
    const json = await postJson<{ data?: { creator_nickname?: string } }>(
      "post/publish/creator_info/query/",
      token,
      {}
    );
    return { nickname: json.data?.creator_nickname };
  } catch {
    return null;
  }
}

// Publish a video by URL (PULL_FROM_URL). Returns the TikTok publish_id.
// The video URL host must be verified in the TikTok developer portal.
export async function publishVideo(
  token: string,
  caption: string,
  videoUrl: string
): Promise<string> {
  const json = await postJson<{ data?: { publish_id?: string } }>(
    "post/publish/video/init/",
    token,
    {
      post_info: { title: caption.slice(0, 2200) },
      source_info: { source: "PULL_FROM_URL", video_url: videoUrl },
    }
  );
  const id = json.data?.publish_id;
  if (!id) throw new Error("TikTok did not return a publish_id");
  return id;
}
