// AI service — calls the Anthropic API when ANTHROPIC_API_KEY is set,
// otherwise falls back to deterministic rule-based generators so the whole
// system remains usable in demo mode.

import Anthropic from "@anthropic-ai/sdk";
import { env, isAiConfigured } from "@/lib/env";
import { PLATFORMS, type PlatformKey } from "@/lib/platforms";
import * as fallback from "@/lib/ai/fallback";

async function generateJSON<T>(system: string, user: string): Promise<T | null> {
  if (!isAiConfigured()) return null;
  try {
    const client = new Anthropic({ apiKey: env.anthropicApiKey });
    const response = await client.messages.create({
      model: env.aiModel,
      max_tokens: 4096,
      system: system + "\nตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอก JSON",
      messages: [{ role: "user", content: user }],
    });
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");
    const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) return null;
    return JSON.parse(match[0]) as T;
  } catch {
    // API error → caller falls back to rule-based path
    return null;
  }
}

export interface ProductScore {
  score: number;
  tier: "hero" | "growth" | "test" | "watchlist";
  rationale: string;
}

export async function scoreProduct(product: {
  name: string;
  price?: number | null;
  commission_rate?: number | null;
  source?: string | null;
  notes?: string | null;
}): Promise<ProductScore> {
  const ai = await generateJSON<ProductScore>(
    "คุณคือผู้เชี่ยวชาญวิเคราะห์สินค้า affiliate ให้คะแนนโอกาสทำเงิน 0-100 และจัดกลุ่ม tier: hero (>=80), growth (60-79), test (40-59), watchlist (<40)",
    `วิเคราะห์สินค้า: ${JSON.stringify(product)} — ตอบ {"score": number, "tier": string, "rationale": string(ภาษาไทย สั้น)}`
  );
  return ai ?? fallback.scoreProduct(product);
}

export interface Brief {
  title: string;
  body: string;
}

export async function generateBrief(input: {
  productName: string;
  goal: string;
  platforms: string[];
}): Promise<Brief> {
  const ai = await generateJSON<Brief>(
    "คุณคือ creative strategist สร้างบรีฟคอนเทนต์สำหรับ creator/affiliate ภาษาไทย",
    `สร้างบรีฟสำหรับสินค้า "${input.productName}" เป้าหมายแคมเปญ: ${input.goal} แพลตฟอร์ม: ${input.platforms.join(", ")} — ตอบ {"title": string, "body": string(บรีฟละเอียด: มุมขาย, กลุ่มเป้าหมาย, key message, โครงคอนเทนต์)}`
  );
  return ai ?? fallback.generateBrief(input);
}

export interface Variant {
  caption: string;
  hashtags: string[];
  cta: string;
}

export async function generateVariant(input: {
  productName: string;
  brief: string;
  platform: PlatformKey;
}): Promise<Variant> {
  const p = PLATFORMS[input.platform];
  const ai = await generateJSON<Variant>(
    `คุณคือ copywriter สร้างแคปชั่นภาษาไทยสำหรับ ${p.label} สไตล์: ${p.style} CTA แนว: ${p.cta} ต้องใส่ affiliate disclosure (#โฆษณา) และ #AIgenerated เสมอ ห้าม claim เกินจริง`,
    `สินค้า: "${input.productName}" บรีฟ: ${input.brief.slice(0, 1500)} — ตอบ {"caption": string, "hashtags": string[](ไม่ต้องมี #), "cta": string}`
  );
  return ai ?? fallback.generateVariant(input);
}

export async function rewriteForCompliance(input: {
  caption: string;
  platform: PlatformKey;
  issues: string[];
}): Promise<string> {
  const ai = await generateJSON<{ caption: string }>(
    "คุณคือผู้เชี่ยวชาญ compliance แก้แคปชั่นให้ผ่านกฎโดยคงพลังการขายไว้",
    `แก้แคปชั่นนี้ให้ผ่าน compliance ของ ${PLATFORMS[input.platform].label}: "${input.caption}" ปัญหาที่พบ: ${input.issues.join("; ")} — ตอบ {"caption": string}`
  );
  return ai?.caption ?? fallback.rewriteForCompliance(input);
}

export interface AdvisorRecommendation {
  topic: string;
  recommendation: string;
  priority: "high" | "medium" | "low";
}

// The advisor now grounds every prompt in a 14-day trend summary so the
// recommendations reference real numbers ("revenue trending +22% — double
// down on X") instead of generic best-practice.
export async function adviseNextCycle(summary: {
  totals: Record<string, number>;
  byPlatform: { platform: string; views: number; clicks: number; revenue: number; commission: number }[];
  topProducts: { name: string; revenue: number }[];
  trends?: import("@/lib/analytics/trends").TrendSummary;
}): Promise<AdvisorRecommendation[]> {
  const ai = await generateJSON<AdvisorRecommendation[]>(
    "คุณคือ growth advisor สำหรับ creator/affiliate ในตลาดไทย วิเคราะห์ผลงานจริงและแนะนำรอบถัดไป อ้างอิงตัวเลขในบรีฟเสมอ ห้ามแต่งตัวเลข ห้ามพูดกว้างๆ ตอบภาษาไทย",
    `ข้อมูลผลงาน: ${JSON.stringify(summary)} — ตอบ JSON array ของ {"topic": string, "recommendation": string(อ้างตัวเลขจริง เช่น "+22% รายได้ใน 14 วัน"), "priority": "high"|"medium"|"low"} 3-5 ข้อ ครอบคลุมด้าน: สินค้า, เวลาโพสต์, รูปแบบคอนเทนต์, แพลตฟอร์ม, และคำเตือนถ้าเห็น trend ตกลง`
  );
  return ai ?? fallback.adviseNextCycle(summary);
}

export function aiMode(): "anthropic" | "rule_based" {
  return isAiConfigured() ? "anthropic" : "rule_based";
}
