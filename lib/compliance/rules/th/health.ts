import type { CategoryComplianceConfig } from "@/lib/compliance/types";

// Health / supplement / medical device (อย.).
// Thai FDA blocks any therapeutic claim on food supplements — "cures", "treats",
// disease names, etc. Weight-loss and "boost immunity" claims are the most
// commonly flagged. Registered products must show an อย. registration number.
export const health: CategoryComplianceConfig = {
  regulator: "อย. (อาหาร/ยา/ผลิตภัณฑ์เสริมอาหาร)",
  prohibited: [
    // Disease-treatment framing — a food supplement can never claim to treat.
    // Covers formal and informal disease names common on Thai social media,
    // including "โควิด/covid" (pandemic-era claims) and "ภูมิแพ้".
    {
      pattern:
        /รักษา(โรค|มะเร็ง|เบาหวาน|ความดัน|หัวใจ|ไต|ตับ|อัลไซเมอร์|โควิด|covid|ภูมิแพ้)/i,
      label: "อ้างรักษาโรค",
    },
    { pattern: /ต้าน(มะเร็ง|เชื้อ(ไวรัส|โควิด))/, label: "อ้างต้านมะเร็ง/ไวรัส" },
    { pattern: /ยารักษาโรค/, label: "อ้างเป็นยา" },
    // "Boost immunity" / "cures the root cause" — regulator-flagged terms.
    { pattern: /เสริม(ภูมิ|ภูมิคุ้มกัน).{0,10}(ทันที|ในทันที)/, label: "อ้างเสริมภูมิทันที" },
    { pattern: /แก้ที่ต้นเหตุ/, label: "อ้างแก้ที่ต้นเหตุ" },
    // Numeric weight-loss timelines. "น้ำหนัก" is optional because the more
    // common phrasing puts the number right after "ลด" ("ลด 5 กก. ใน 7 วัน").
    {
      pattern: /ลด(น้ำหนัก)?\s*\d+\s*(กิโล|กก|kg).{0,10}(ใน\s*\d+\s*(วัน|สัปดาห์|เดือน))?/i,
      label: "อ้างลดน้ำหนักเป็นตัวเลข",
    },
    // "ความอ้วน" also covered — อย. treats obesity as a medical condition.
    { pattern: /ลด(น้ำหนัก|ความอ้วน)(เร็ว|ทันที|ถาวร)/, label: "อ้างลดน้ำหนัก/ความอ้วนเร็ว/ถาวร" },
    // Doctor endorsement without registration. Informal "หมอ" is far more
    // common than the formal "แพทย์" in social copy.
    { pattern: /(แพทย์|หมอ)(รับรอง|แนะนำ)/, label: "อ้างแพทย์/หมอรับรอง (ต้องมีหลักฐาน)" },
  ],
  required: {
    label: "คำเตือนตาม พ.ร.บ. อาหาร (health)",
    patterns: [
      /ไม่ใช่ยา/,
      /ผลิตภัณฑ์เสริมอาหาร/,
      /อย\.?\s*(เลขที่|เลข)?\s*[\d\-/]{3,}/i,
      // Legally mandated warnings under พ.ร.บ. อาหาร พ.ศ. 2522.
      /ไม่มีผลในการป้องกันหรือรักษาโรค/,
      /เด็กและสตรีมีครรภ์/,
      /ผลลัพธ์ขึ้นอยู่กับ(บุคคล|แต่ละคน)/,
    ],
    message:
      "ต้องมีข้อความ 'ผลิตภัณฑ์เสริมอาหาร ไม่ใช่ยา', 'ไม่มีผลในการป้องกันหรือรักษาโรค' หรือระบุ อย. เลขที่ (พ.ร.บ. อาหาร)",
  },
};
