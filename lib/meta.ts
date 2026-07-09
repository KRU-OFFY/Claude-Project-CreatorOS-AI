import "server-only";

// Meta Graph API client for Facebook Pages + Instagram publishing and insights.
// Real publishing activates when META_APP_ID / META_APP_SECRET are set and a
// workspace has connected an account (OAuth flow in app/api/connect/meta/*).

const GRAPH = "https://graph.facebook.com/v21.0";

export function metaConfigured(): boolean {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

export function appRedirectUri(origin: string): string {
  return process.env.META_REDIRECT_URI || `${origin}/api/connect/meta/callback`;
}

// Scopes needed to list pages, publish, and read insights for FB + IG.
const SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_content_publish",
  "read_insights",
  "business_management",
].join(",");

export function authDialogUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID ?? "",
    redirect_uri: appRedirectUri(origin),
    state,
    scope: SCOPES,
    response_type: "code",
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
}

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${GRAPH}/${path}?${qs}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? `Graph GET ${path} failed`);
  return json as T;
}

async function graphPost<T>(path: string, body: Record<string, string>): Promise<T> {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? `Graph POST ${path} failed`);
  return json as T;
}

// Exchange the OAuth code for a short-lived user token.
export async function exchangeCode(origin: string, code: string): Promise<string> {
  const data = await graphGet<{ access_token: string }>("oauth/access_token", {
    client_id: process.env.META_APP_ID ?? "",
    client_secret: process.env.META_APP_SECRET ?? "",
    redirect_uri: appRedirectUri(origin),
    code,
  });
  return data.access_token;
}

export interface TokenResult {
  token: string;
  expiresAt: string | null; // ISO; null when the API omits expires_in
}

// Upgrade to (or refresh) a long-lived (~60 day) user token.
export async function longLivedToken(shortOrLongToken: string): Promise<TokenResult> {
  const data = await graphGet<{ access_token: string; expires_in?: number }>(
    "oauth/access_token",
    {
      grant_type: "fb_exchange_token",
      client_id: process.env.META_APP_ID ?? "",
      client_secret: process.env.META_APP_SECRET ?? "",
      fb_exchange_token: shortOrLongToken,
    }
  );
  const expiresAt =
    typeof data.expires_in === "number"
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null;
  return { token: data.access_token, expiresAt };
}

export interface MetaPage {
  id: string;
  name: string;
  access_token: string; // page token
  instagram_business_account?: { id: string };
}

// List the pages the user manages, including any linked IG business account.
export async function listPages(userToken: string): Promise<MetaPage[]> {
  const data = await graphGet<{ data: MetaPage[] }>("me/accounts", {
    access_token: userToken,
    fields: "id,name,access_token,instagram_business_account",
  });
  return data.data ?? [];
}

// Publish a text/link post to a Facebook Page.
export async function publishFacebook(
  pageId: string,
  pageToken: string,
  message: string,
  link?: string | null
): Promise<string> {
  const body: Record<string, string> = { message, access_token: pageToken };
  if (link) body.link = link;
  const res = await graphPost<{ id: string }>(`${pageId}/feed`, body);
  return res.id; // {pageId}_{postId}
}

// Publish an image post to an Instagram business account (2-step: container → publish).
export async function publishInstagram(
  igUserId: string,
  pageToken: string,
  caption: string,
  imageUrl: string
): Promise<string> {
  const container = await graphPost<{ id: string }>(`${igUserId}/media`, {
    image_url: imageUrl,
    caption,
    access_token: pageToken,
  });
  const published = await graphPost<{ id: string }>(`${igUserId}/media_publish`, {
    creation_id: container.id,
    access_token: pageToken,
  });
  return published.id;
}

export interface MetaInsight {
  impressions?: number;
  reach?: number;
  engagement?: number;
  clicks?: number;
}

// Read basic insights for a published Facebook post.
export async function facebookPostInsights(
  postId: string,
  pageToken: string
): Promise<MetaInsight> {
  try {
    const data = await graphGet<{ data: { name: string; values: { value: number }[] }[] }>(
      `${postId}/insights`,
      {
        metric: "post_impressions,post_impressions_unique,post_clicks",
        access_token: pageToken,
      }
    );
    const pick = (n: string) => data.data.find((d) => d.name === n)?.values?.[0]?.value ?? 0;
    return {
      impressions: pick("post_impressions"),
      reach: pick("post_impressions_unique"),
      clicks: pick("post_clicks"),
    };
  } catch {
    return {};
  }
}

// Read basic insights for a published Instagram media object.
export async function instagramMediaInsights(
  mediaId: string,
  pageToken: string
): Promise<MetaInsight> {
  try {
    const data = await graphGet<{ data: { name: string; values: { value: number }[] }[] }>(
      `${mediaId}/insights`,
      { metric: "impressions,reach,engagement", access_token: pageToken }
    );
    const pick = (n: string) => data.data.find((d) => d.name === n)?.values?.[0]?.value ?? 0;
    return {
      impressions: pick("impressions"),
      reach: pick("reach"),
      engagement: pick("engagement"),
    };
  } catch {
    return {};
  }
}
