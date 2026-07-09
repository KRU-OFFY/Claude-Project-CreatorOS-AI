// Platform Adapter Layer — one interface, one implementation per platform.
// This keeps the system platform-agnostic (no Shopee-first coupling).

import type { PlatformKey } from "@/lib/platforms";

export interface PublishInput {
  caption: string;
  hashtags: string[];
  cta?: string | null;
  mediaUrl?: string | null;
  scheduledAt?: string | null;
}

export interface PublishResult {
  ok: boolean;
  publishedUrl?: string;
  error?: string;
  // 'manual' means the connector is a stub — user must copy-to-post by hand.
  mode: "api" | "manual";
}

export interface RawMetrics {
  views?: number;
  reach?: number;
  engagement?: number;
  clicks?: number;
  orders?: number;
  revenue?: number;
  commission?: number;
}

export interface PlatformAdapter {
  platform: PlatformKey;
  // Env var name that must be set for real (non-stub) publishing.
  credentialEnv: string;
  isConfigured(): boolean;
  publish(input: PublishInput): Promise<PublishResult>;
  fetchMetrics(externalId: string): Promise<RawMetrics | null>;
  validateAuth(): Promise<boolean>;
}
