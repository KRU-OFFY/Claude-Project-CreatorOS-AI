// Rule-based fallbacks for the AI service — used when ANTHROPIC_API_KEY is
// unset so the whole product stays usable in demo mode (no crashes).

import { PLATFORMS, type PlatformKey } from "@/lib/platforms";
import type { ProductScore, Brief, Variant, AdvisorRecommendation } from "@/lib/ai";

export function scoreProduct(product: {
  price?: number | null;
  commission_rate?: number | null;
}): ProductScore {
  const commission = product.commission_rate ?? 0;
  const price = product.price ?? 0;
  // Simple heuristic: commission weight + price sweet-spot.
  const commissionScore = Math.min(commission * 4, 55); // up to 55
  const priceScore = price > 0 && price <= 800 ? 30 : price <= 1500 ? 20 : 10;
  const base = 15;
  const score = Math.max(0, Math.min(100, Math.round(base + commissionScore + priceScore)));
  const tier: ProductScore["tier"] =
    score >= 80 ? "hero" : score >= 60 ? "growth" : score >= 40 ? "test" : "watchlist";
  return {
    score,
    tier,
    rationale: `ประเมินจากค่าคอมมิชชั่น ${commission}% และช่วงราคา ${price} บาท (โหมด demo — ใส่ ANTHROPIC_API_KEY เพื่อใช้ AI จริง)`,
  };
}

export function generateBrief(input: {
  productName: string;
  goal: string;
  platforms: string[];
}): Brief {
  return {
    title: `บรีฟคอนเทนต์: ${input.productName}`,
    body: [
      `เป้าหมายแคมเปญ: ${input.goal}`,
      `มุมขาย: เน้นประโยชน์หลักและปัญหาที่สินค้าช่วยแก้`,
      `กลุ่มเป้าหมาย: ผู้ที่สนใจ ${input.productName}`,
      `Key message: คุ้มค่า ใช้ง่าย เห็นผล`,
      `ช่องทาง: ${input.platforms.join(", ")}`,
      `โครงคอนเทนต์: Hook → ปัญหา → ทางแก้ (สินค้า) → หลักฐาน/รีวิว → CTA`,
      `(โหมด demo — ใส่ ANTHROPIC_API_KEY เพื่อให้ AI สร้างบรีฟเชิงลึก)`,
    ].join("\n"),
  };
}

export function generateVariant(input: {
  productName: string;
  platform: PlatformKey;
}): Variant {
  const p = PLATFORMS[input.platform];
  return {
    caption: `${input.productName} ตัวนี้ปังมาก! ${p.style} — บอกเลยว่าคุ้ม 🛒 #โฆษณา #AIgenerated`,
    hashtags: ["รีวิวสินค้า", "ของดีบอกต่อ", input.productName.replace(/\s+/g, "")],
    cta: p.cta,
  };
}

export function rewriteForCompliance(input: { caption: string }): string {
  // Ensure disclosure + AI label are present; strip obvious risky words.
  let text = input.caption
    .replace(/รักษา(โรค|หาย|ขาด)/g, "ดูแล")
    .replace(/หายขาด/g, "ช่วยดูแล")
    .replace(/100\s*%|ร้อยเปอร์เซ็นต์/g, "")
    .replace(/การันตี(ผล|รวย|กำไร)/g, "");
  if (!/#โฆษณา|#ad/i.test(text)) text += " #โฆษณา";
  if (!/#aigenerated|#ai/i.test(text)) text += " #AIgenerated";
  return text.trim();
}

export function adviseNextCycle(summary: {
  byPlatform: { platform: string; views: number; clicks: number; revenue: number }[];
  topProducts: { name: string; revenue: number }[];
}): AdvisorRecommendation[] {
  const recs: AdvisorRecommendation[] = [];
  const best = [...summary.byPlatform].sort((a, b) => b.revenue - a.revenue)[0];
  if (best) {
    recs.push({
      topic: "แพลตฟอร์ม",
      recommendation: `${best.platform} ทำรายได้ดีที่สุด — เพิ่มความถี่โพสต์บนช่องนี้ในรอบถัดไป`,
      priority: "high",
    });
  }
  const topProduct = summary.topProducts[0];
  if (topProduct) {
    recs.push({
      topic: "สินค้า",
      recommendation: `"${topProduct.name}" ขายดี — หาสินค้าใกล้เคียงมาทำคอนเทนต์เพิ่ม`,
      priority: "medium",
    });
  }
  recs.push({
    topic: "เวลาโพสต์",
    recommendation: "ทดลองโพสต์ช่วง 19:00–21:00 ซึ่งมักมี engagement สูง",
    priority: "medium",
  });
  recs.push({
    topic: "รูปแบบคอนเทนต์",
    recommendation: "เพิ่มคลิปสั้นแบบ Hook 3 วินาทีสำหรับ TikTok/Reels",
    priority: "low",
  });
  return recs;
}
