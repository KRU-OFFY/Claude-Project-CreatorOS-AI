import type { CategoryComplianceConfig } from "@/lib/compliance/types";

// Health / supplement / medical device (อย.).
// Thai FDA blocks any therapeutic claim on food supplements — "cures", "treats",
// disease names, etc. Weight-loss and "boost immunity" claims are the most
// commonly flagged. Registered products must show an อย. registration number.
export const health: CategoryComplianceConfig = {
  regulator: "อย. (อาหาร/ยา/ผลิตภัณฑ์เสริมอาหาร)",
  prohibited: [
    // Disease-treatment framing — a food supplement can never claim to treat.
    { pattern: /รักษา(โรค|มะเร็ง|เบาหวาน|ความดัน|หัวใจ|ไต|ตับ|อัลไซเมอร์)/, label: "อ้างรักษาโรค" },
    { pattern: /ต้าน(มะเร็ง|เชื้อ(ไวรัส|โควิด))/, label: "อ้างต้านมะเร็ง/ไวรัส" },
    { pattern: /ยารักษาโรค/, label: "อ้างเป็นยา" },
    // "Boost immunity" / "cures the root cause" — regulator-flagged terms.
    { pattern: /เสริม(ภูมิ|ภูมิคุ้มกัน).{0,10}(ทันที|ในทันที)/, label: "อ้างเสริมภูมิทันที" },
    { pattern: /แก้ที่ต้นเหตุ/, label: "อ้างแก้ที่ต้นเหตุ" },
    // Numeric weight-loss timelines.
    { pattern: /ลด\s*\d+\s*(กิโล|กก|kg).{0,10}(ใน\s*\d+\s*(วัน|สัปดาห์|เดือน))?/i, label: "อ้างลดน้ำหนักเป็นตัวเลข" },
    { pattern: /ลดน้ำหนัก(เร็ว|ทันที|ถาวร)/, label: "อ้างลดน้ำหนักเร็ว/ถาวร" },
    // Doctor endorsement without registration.
    { pattern: /แพทย์(รับรอง|แนะนำ)/, label: "อ้างแพทย์รับรอง (ต้องมีหลักฐาน)" },
  ],
  required: {
    label: "คำเตือน 'ไม่ใช่ยา' / อย. เลขที่ (health)",
    patterns: [
      /ไม่ใช่ยา/,
      /ผลิตภัณฑ์เสริมอาหาร/,
      /อย\.?\s*(เลขที่|เลข)?\s*[\d\-/]{3,}/i,
      /ผลลัพธ์ขึ้นอยู่กับ(บุคคล|แต่ละคน)/,
    ],
    message:
      "ต้องมีข้อความ 'ผลิตภัณฑ์เสริมอาหาร ไม่ใช่ยา' หรือระบุ อย. เลขที่ (มาตรา 40 พ.ร.บ. อาหาร)",
  },
};
