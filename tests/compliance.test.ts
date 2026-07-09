import { describe, it, expect } from "vitest";
import { checkCompliance } from "@/lib/compliance";

const base = { hashtags: [] as string[], aiGenerated: true };

describe("compliance engine", () => {
  it("fails when affiliate disclosure is missing", () => {
    const r = checkCompliance({ platform: "facebook", caption: "สินค้าดีมาก ซื้อเลย", ...base });
    const disclosure = r.results.find((x) => x.rule === "affiliate_disclosure")!;
    expect(disclosure.passed).toBe(false);
    expect(r.status).toBe("fail");
  });

  it("passes disclosure when #โฆษณา present", () => {
    const r = checkCompliance({
      platform: "facebook",
      caption: "สินค้าดีมาก #โฆษณา",
      ...base,
      aiGenerated: false,
    });
    expect(r.results.find((x) => x.rule === "affiliate_disclosure")!.passed).toBe(true);
  });

  it("flags prohibited claims (รักษาโรค)", () => {
    const r = checkCompliance({
      platform: "facebook",
      caption: "ครีมนี้รักษาโรคผิวหนังได้ #โฆษณา",
      ...base,
      aiGenerated: false,
    });
    expect(r.results.find((x) => x.rule === "prohibited_claims")!.passed).toBe(false);
    expect(r.riskLevel).toBe("high");
    expect(r.claimRiskScore).toBeGreaterThan(0);
  });

  it("requires AI label on instagram for AI content", () => {
    const withoutLabel = checkCompliance({
      platform: "instagram",
      caption: "รีวิวสินค้า #โฆษณา",
      hashtags: [],
      aiGenerated: true,
    });
    expect(withoutLabel.results.find((x) => x.rule === "ai_label")!.passed).toBe(false);

    const withLabel = checkCompliance({
      platform: "instagram",
      caption: "รีวิวสินค้า #โฆษณา #AIgenerated",
      hashtags: [],
      aiGenerated: true,
    });
    expect(withLabel.results.find((x) => x.rule === "ai_label")!.passed).toBe(true);
  });

  it("does not require AI label on facebook", () => {
    const r = checkCompliance({
      platform: "facebook",
      caption: "รีวิว #โฆษณา",
      hashtags: [],
      aiGenerated: true,
    });
    const aiLabel = r.results.find((x) => x.rule === "ai_label")!;
    expect(aiLabel.passed).toBe(true); // not mandated
  });

  it("flags caption over the X 280-char limit", () => {
    const long = "ก".repeat(300);
    const r = checkCompliance({ platform: "x", caption: long + " #ad", hashtags: [], aiGenerated: false });
    expect(r.results.find((x) => x.rule === "caption_length")!.passed).toBe(false);
  });

  it("clean approved-style caption yields pass", () => {
    const r = checkCompliance({
      platform: "facebook",
      caption: "รีวิวของใช้ดีๆ ได้รับค่าคอมมิชชั่น #โฆษณา",
      hashtags: [],
      aiGenerated: false,
    });
    expect(r.status).toBe("pass");
    expect(r.riskLevel).toBe("low");
  });
});
