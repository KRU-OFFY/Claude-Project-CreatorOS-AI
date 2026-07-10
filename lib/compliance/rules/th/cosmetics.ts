import type { CategoryComplianceConfig } from "@/lib/compliance/types";

// Cosmetics (อย. Cosmetics Act พ.ศ. 2558).
// Cosmetics may only claim external/cosmetic effect. Treatment claims ("รักษาสิว",
// "ผิวขาวถาวร") reclassify the product as a drug and become an อย. violation.
export const cosmetics: CategoryComplianceConfig = {
  regulator: "อย. (เครื่องสำอาง)",
  prohibited: [
    { pattern: /รักษา(สิว|ฝ้า|กระ|ริ้วรอย|ผื่น|โรคผิวหนัง)/, label: "อ้างรักษาปัญหาผิว" },
    { pattern: /ขาว(ถาวร|ทันที|ใน\s*\d+\s*(วัน|ชั่วโมง|นาที))/, label: "อ้างขาวถาวร/รวดเร็ว" },
    { pattern: /หน้าเด็ก(ลง)?\s*\d+\s*ปี/, label: "อ้างย้อนอายุเป็นตัวเลข" },
    { pattern: /ลด(ริ้วรอย|ฝ้า|กระ).{0,10}(ถาวร|ทันที|หายขาด)/, label: "อ้างลดริ้วรอยถาวร" },
    { pattern: /ยา(ทา|รักษา)ผิว/, label: "อ้างเป็นยา" },
    // "Whiter than a foreigner" / racial framing — regulator-flagged in ads.
    { pattern: /ขาว(กว่าฝรั่ง|เหมือนฝรั่ง|เกาหลี|ญี่ปุ่น)/, label: "เปรียบเทียบเชื้อชาติ" },
    { pattern: /เห็นผลใน\s*[1-3]\s*(วัน|ครั้ง)/, label: "อ้างเห็นผลใน 1-3 วัน" },
  ],
  required: {
    label: "หมายเหตุผลลัพธ์ / อย. เลขที่ (cosmetics)",
    patterns: [
      /ผลลัพธ์ขึ้นอยู่กับ(บุคคล|แต่ละคน|สภาพผิว)/,
      /อย\.?\s*(เลขที่|เลข|จดแจ้ง)?\s*[\d\-/]{3,}/i,
      /ทดสอบก่อนใช้/,
    ],
    message:
      "ต้องระบุหมายเหตุ 'ผลลัพธ์ขึ้นอยู่กับสภาพผิวของแต่ละบุคคล' หรือ อย. เลขจดแจ้ง (พ.ร.บ. เครื่องสำอาง)",
  },
};
