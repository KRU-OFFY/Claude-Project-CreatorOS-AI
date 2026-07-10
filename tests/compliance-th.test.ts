import { describe, it, expect } from "vitest";
import { checkCompliance } from "@/lib/compliance";

// Base disclosure that keeps affiliate/AI rules from failing so we can
// isolate the category-specific rule packs added in Track H.
const clean = "รีวิว #โฆษณา ได้รับค่าคอมมิชชั่น";

describe("Track H — Thai regulatory rule packs", () => {
  describe("health (อย.)", () => {
    it("flags 'รักษาโรค' claim on a supplement", () => {
      const r = checkCompliance({
        platform: "facebook",
        caption: `${clean} กินแล้วรักษาโรคเบาหวานได้`,
        hashtags: [],
        aiGenerated: false,
        productCategory: "health",
      });
      const prohib = r.results.find((x) => x.rule === "prohibited_claims")!;
      expect(prohib.passed).toBe(false);
      expect(prohib.label).toContain("อย.");
      expect(r.status).toBe("fail");
    });

    it("flags numeric weight-loss timeline", () => {
      const r = checkCompliance({
        platform: "facebook",
        caption: `${clean} ลด 5 กก. ใน 7 วัน`,
        hashtags: [],
        aiGenerated: false,
        productCategory: "health",
      });
      expect(r.results.find((x) => x.rule === "prohibited_claims")!.passed).toBe(false);
    });

    it("requires 'ไม่ใช่ยา' or อย. registration disclaimer", () => {
      const missing = checkCompliance({
        platform: "facebook",
        caption: `${clean} ทานทุกวันเพื่อสุขภาพ`,
        hashtags: [],
        aiGenerated: false,
        productCategory: "health",
      });
      const req = missing.results.find(
        (x) => x.rule === "category_required_disclaimer"
      )!;
      expect(req.passed).toBe(false);

      const present = checkCompliance({
        platform: "facebook",
        caption: `${clean} ทานทุกวัน ผลิตภัณฑ์เสริมอาหาร ไม่ใช่ยา`,
        hashtags: [],
        aiGenerated: false,
        productCategory: "health",
      });
      expect(
        present.results.find((x) => x.rule === "category_required_disclaimer")!
          .passed
      ).toBe(true);
    });
  });

  describe("cosmetics (อย.)", () => {
    it("flags 'ขาวถาวร' claim", () => {
      const r = checkCompliance({
        platform: "instagram",
        caption: `${clean} ครีมนี้ทำให้ขาวถาวร #AIgenerated`,
        hashtags: [],
        aiGenerated: true,
        productCategory: "cosmetics",
      });
      expect(r.results.find((x) => x.rule === "prohibited_claims")!.passed).toBe(false);
    });

    it("flags 'รักษาสิว' claim", () => {
      const r = checkCompliance({
        platform: "instagram",
        caption: `${clean} รักษาสิวได้ในทันที #AIgenerated`,
        hashtags: [],
        aiGenerated: true,
        productCategory: "cosmetics",
      });
      expect(r.results.find((x) => x.rule === "prohibited_claims")!.passed).toBe(false);
    });

    it("passes with proper disclaimer and no forbidden claims", () => {
      const r = checkCompliance({
        platform: "instagram",
        caption: `${clean} ผิวดูดีขึ้น ผลลัพธ์ขึ้นอยู่กับสภาพผิวของแต่ละบุคคล #AIgenerated`,
        hashtags: [],
        aiGenerated: true,
        productCategory: "cosmetics",
      });
      const prohib = r.results.find((x) => x.rule === "prohibited_claims")!;
      const req = r.results.find((x) => x.rule === "category_required_disclaimer")!;
      expect(prohib.passed).toBe(true);
      expect(req.passed).toBe(true);
    });
  });

  describe("financial (ก.ล.ต.)", () => {
    it("flags return-guarantee claim", () => {
      const r = checkCompliance({
        platform: "facebook",
        caption: `${clean} การันตีผลตอบแทน 10% ต่อเดือน`,
        hashtags: [],
        aiGenerated: false,
        productCategory: "financial",
      });
      expect(r.results.find((x) => x.rule === "prohibited_claims")!.passed).toBe(false);
      expect(r.status).toBe("fail");
    });

    it("requires investment risk disclaimer", () => {
      const missing = checkCompliance({
        platform: "facebook",
        caption: `${clean} มาลงทุนกัน`,
        hashtags: [],
        aiGenerated: false,
        productCategory: "financial",
      });
      expect(
        missing.results.find((x) => x.rule === "category_required_disclaimer")!.passed
      ).toBe(false);

      const present = checkCompliance({
        platform: "facebook",
        caption: `${clean} มาลงทุนกัน การลงทุนมีความเสี่ยง ผู้ลงทุนควรศึกษาข้อมูลก่อนตัดสินใจลงทุน`,
        hashtags: [],
        aiGenerated: false,
        productCategory: "financial",
      });
      expect(
        present.results.find((x) => x.rule === "category_required_disclaimer")!.passed
      ).toBe(true);
    });
  });

  describe("general (no category)", () => {
    it("does not add category-specific rules for 'general'", () => {
      const r = checkCompliance({
        platform: "facebook",
        caption: `${clean} ทานทุกวันเพื่อสุขภาพ`,
        hashtags: [],
        aiGenerated: false,
        productCategory: "general",
      });
      expect(
        r.results.find((x) => x.rule === "category_required_disclaimer")
      ).toBeUndefined();
    });

    it("does not add category-specific rules when omitted", () => {
      const r = checkCompliance({
        platform: "facebook",
        caption: `${clean} ทานทุกวันเพื่อสุขภาพ`,
        hashtags: [],
        aiGenerated: false,
      });
      expect(
        r.results.find((x) => x.rule === "category_required_disclaimer")
      ).toBeUndefined();
    });
  });
});
