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

// App credentials may come from env or the in-app settings center
// (workspace_settings, Track L) — callers that know the workspace pass creds.
export interface TikTokCreds {
  clientKey: string;
  clientSecret: string;
}

function resolveCreds(creds?: Partial<TikTokCreds> | null): TikTokCreds {
  return {
    clientKey: creds?.clientKey || process.env.TIKTOK_CLIENT_KEY || "",
    clientSecret: creds?.clientSecret || process.env.TIKTOK_CLIENT_SECRET || "",
  };
}

export function tiktokConfigured(creds?: Partial<TikTokCreds> | null): boolean {
  const c = resolveCreds(creds);
  return Boolean(c.clientKey && c.clientSecret);
}

export function tiktokRedirectUri(origin: string): string {
  return process.env.TIKTOK_REDIRECT_URI || `${origin}/api/connect/tiktok/callback`;
}

export function authUrl(
  origin: string,
  state: string,
  creds?: Partial<TikTokCreds> | null
): string {
  const params = new URLSearchParams({
    client_key: resolveCreds(creds).clientKey,
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
  // Scope actually granted by the user (comma-separated). Callback verifies
  // that `video.publish` is present before saving the connection — otherwise
  // publish attempts fail at post time with a confusing error.
  scope: string;
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
  scope?: string;
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
    scope: r.scope ?? "",
  };
}

export async function exchangeCode(
  origin: string,
  code: string,
  creds?: Partial<TikTokCreds> | null
): Promise<TikTokToken> {
  const c = resolveCreds(creds);
  const r = await postForm<TokenResponse>(`${API}/oauth/token/`, {
    client_key: c.clientKey,
    client_secret: c.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: tiktokRedirectUri(origin),
  });
  return toToken(r);
}

export async function refreshAccessToken(
  refreshToken: string,
  creds?: Partial<TikTokCreds> | null
): Promise<TikTokToken> {
  const c = resolveCreds(creds);
  const r = await postForm<TokenResponse>(`${API}/oauth/token/`, {
    client_key: c.clientKey,
    client_secret: c.clientSecret,
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
  // TikTok signals success only when error.code === "ok". Anything else — an
  // HTTP failure, a missing error object, or an error code that isn't "ok" —
  // must throw so callers don't proceed on empty data.
  if (!res.ok || json?.error?.code !== "ok") {
    throw new Error(json?.error?.message || `TikTok ${path} failed (${res.status})`);
  }
  return json as T;
}

export interface CreatorInfo {
  nickname?: string;
  // Which privacy levels this creator+app combination is allowed to post as.
  // Direct Post requires this value in the payload — sending an unsupported
  // one is rejected. Unaudited apps typically only get SELF_ONLY.
  privacyLevelOptions: string[];
}

// Validate the token by querying creator info (also confirms posting eligibility).
export async function creatorInfo(token: string): Promise<CreatorInfo | null> {
  try {
    const json = await postJson<{
      data?: { creator_nickname?: string; privacy_level_options?: string[] };
    }>("post/publish/creator_info/query/", token, {});
    return {
      nickname: json.data?.creator_nickname,
      privacyLevelOptions: json.data?.privacy_level_options ?? [],
    };
  } catch {
    return null;
  }
}

// Publish a video by URL (PULL_FROM_URL). Returns the TikTok publish_id.
// The video URL host must be verified in the TikTok developer portal.
//
// `privacyLevel` is REQUIRED by the Direct Post API — TikTok rejects payloads
// without it. Callers should pass a value returned by `creatorInfo` (unaudited
// apps only get SELF_ONLY, which lands in the creator's private drafts).
export async function publishVideo(
  token: string,
  caption: string,
  videoUrl: string,
  privacyLevel: string
): Promise<string> {
  const json = await postJson<{ data?: { publish_id?: string } }>(
    "post/publish/video/init/",
    token,
    {
      post_info: {
        title: caption.slice(0, 2200),
        privacy_level: privacyLevel,
      },
      source_info: { source: "PULL_FROM_URL", video_url: videoUrl },
    }
  );
  const id = json.data?.publish_id;
  if (!id) throw new Error("TikTok did not return a publish_id");
  return id;
}

// True when the granted scope actually includes `video.publish`. TikTok lets
// the user deny individual scopes on the consent screen — without this one,
// the connection is unusable for publishing.
export function hasPublishScope(scope: string): boolean {
  return scope
    .split(",")
    .map((s) => s.trim())
    .includes("video.publish");
}
