import "server-only";

// YouTube connector — Google OAuth v2 + Data API v3 (videos.insert).
// Publishing activates when GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are set
// and a workspace connects a channel (OAuth in app/api/connect/youtube/*).
//
// Note: the video body is fetched from `media_url` and streamed to YouTube.
// A single POST is used (not resumable) — YouTube accepts uploads up to ~2GB
// this way, which covers typical short/reel content. The response includes
// the new videoId.

const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const UPLOAD = "https://www.googleapis.com/upload/youtube/v3/videos";
const API = "https://www.googleapis.com/youtube/v3";

// youtube.upload — insert videos on the connected channel.
// youtube.readonly — read channel/video info (used by the callback to
// derive an account name for the settings card).
const SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"].join(" ");

export function youtubeConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function youtubeRedirectUri(origin: string): string {
  return process.env.GOOGLE_REDIRECT_URI || `${origin}/api/connect/youtube/callback`;
}

export function authUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    scope: SCOPES,
    response_type: "code",
    redirect_uri: youtubeRedirectUri(origin),
    // access_type=offline + prompt=consent guarantees a refresh_token even on
    // re-connects; without it Google only returns refresh_token the first time
    // a user grants the app.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH}?${params.toString()}`;
}

export interface YouTubeToken {
  token: string;
  refreshToken: string | null;
  expiresAt: string | null;
  scope: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
}

function toToken(r: TokenResponse): YouTubeToken {
  return {
    token: r.access_token,
    refreshToken: r.refresh_token ?? null,
    expiresAt:
      typeof r.expires_in === "number"
        ? new Date(Date.now() + r.expires_in * 1000).toISOString()
        : null,
    scope: r.scope ?? "",
  };
}

async function postForm<T>(url: string, body: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  const json = (await res.json()) as Record<string, unknown> & {
    error?: string;
    error_description?: string;
  };
  if (!res.ok || json.error) {
    throw new Error(
      (json.error_description as string) ?? (json.error as string) ?? `YouTube ${url} failed`
    );
  }
  return json as unknown as T;
}

export async function exchangeCode(origin: string, code: string): Promise<YouTubeToken> {
  const r = await postForm<TokenResponse>(TOKEN, {
    code,
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    redirect_uri: youtubeRedirectUri(origin),
    grant_type: "authorization_code",
  });
  return toToken(r);
}

export async function refreshAccessToken(refreshToken: string): Promise<YouTubeToken> {
  const r = await postForm<TokenResponse>(TOKEN, {
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  // Google may omit `refresh_token` on a refresh — preserve the original
  // so the caller stores a usable value.
  return { ...toToken(r), refreshToken: r.refresh_token ?? refreshToken };
}

export interface ChannelInfo {
  id: string;
  title: string;
}

// Fetch the authenticated user's channel (used by the OAuth callback to
// derive an account name for the settings card).
export async function myChannel(token: string): Promise<ChannelInfo | null> {
  try {
    const res = await fetch(`${API}/channels?part=snippet&mine=true`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      items?: { id: string; snippet: { title: string } }[];
    };
    const item = json.items?.[0];
    if (!item) return null;
    return { id: item.id, title: item.snippet.title };
  } catch {
    return null;
  }
}

// Publish a video by fetching `videoUrl` and streaming it to YouTube in a
// single upload. Returns the new videoId. `privacyStatus` defaults to
// `private` (safest for unaudited apps and any first-time integration).
export async function publishVideo(
  token: string,
  caption: string,
  videoUrl: string,
  privacyStatus: "private" | "unlisted" | "public" = "private"
): Promise<string> {
  const media = await fetch(videoUrl);
  if (!media.ok || !media.body) {
    throw new Error(`fetch media failed (${media.status})`);
  }

  const metadata = {
    snippet: {
      // YouTube caps titles at 100 chars; strip newlines so the title stays
      // one visible line.
      title: caption.slice(0, 100).replace(/\s+/g, " ").trim() || "Untitled",
      description: caption.slice(0, 5000),
    },
    status: { privacyStatus, selfDeclaredMadeForKids: false },
  };

  // Multipart per YouTube's upload spec: JSON metadata then the video bytes,
  // separated by a boundary. Explicit `uploadType=multipart` ⇒ single POST
  // (no resumable session negotiation).
  const boundary = "creatoros_" + Math.random().toString(36).slice(2);
  const CRLF = "\r\n";
  const head =
    `--${boundary}${CRLF}` +
    `Content-Type: application/json; charset=UTF-8${CRLF}${CRLF}` +
    JSON.stringify(metadata) +
    CRLF +
    `--${boundary}${CRLF}` +
    `Content-Type: ${media.headers.get("content-type") ?? "video/*"}${CRLF}${CRLF}`;
  const tail = `${CRLF}--${boundary}--${CRLF}`;

  const bodyBytes = new Uint8Array(await media.arrayBuffer());
  const encoder = new TextEncoder();
  const headBytes = encoder.encode(head);
  const tailBytes = encoder.encode(tail);
  const combined = new Uint8Array(headBytes.length + bodyBytes.length + tailBytes.length);
  combined.set(headBytes, 0);
  combined.set(bodyBytes, headBytes.length);
  combined.set(tailBytes, headBytes.length + bodyBytes.length);

  const uploadRes = await fetch(`${UPLOAD}?uploadType=multipart&part=snippet,status`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": `multipart/related; boundary=${boundary}`,
    },
    body: combined,
  });
  const json = (await uploadRes.json()) as {
    id?: string;
    error?: { message?: string; errors?: { reason?: string; message?: string }[] };
  };
  if (!uploadRes.ok || !json.id) {
    const detail = json.error?.errors?.[0];
    throw new Error(
      detail?.message ??
        json.error?.message ??
        `YouTube upload failed (${uploadRes.status})`
    );
  }
  return json.id;
}

export function hasUploadScope(scope: string): boolean {
  return scope.includes("youtube.upload");
}
