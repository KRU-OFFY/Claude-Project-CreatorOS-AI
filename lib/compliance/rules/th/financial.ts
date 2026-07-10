import type { CategoryComplianceConfig } from "@/lib/compliance/types";

// Financial / investment products (ก.ล.ต. / ธปท.).
// Return-guarantee claims are banned outright — any ad for securities, funds,
// crypto, or "high-yield opportunities" MUST include a risk disclaimer.
export const financial: CategoryComplianceConfig = {
  regulator: "ก.ล.ต. / ธปท. (การลงทุน)",
  prohibited: [
    { pattern: /การันตี(ผลตอบแทน|กำไร|รายได้|เงินต้น)/, label: "การันตีผลตอบแทน" },
    { pattern: /รับประกัน(กำไร|ผลตอบแทน)/, label: "รับประกันกำไร" },
    { pattern: /(ผลตอบแทน|กำไร)\s*\d+\s*%.{0,15}(ต่อ|ทุก)\s*(วัน|สัปดาห์|เดือน|ปี)/, label: "โฆษณาผลตอบแทนเป็นตัวเลขต่อช่วงเวลา" },
    { pattern: /(ปันผล|ดอกเบี้ย)\s*(สูง|ทุกวัน|ทุกสัปดาห์)/, label: "โฆษณาปันผลสูงต่อช่วงเวลา" },
    { pattern: /รวย(เร็ว|ทางลัด|ในเดือน|ในสัปดาห์)/, label: "ชวนเชื่อรวยเร็ว" },
    { pattern: /ล้านแรก(ใน\s*\d+\s*(วัน|เดือน|สัปดาห์))?/, label: "โฆษณาล้านแรกในเวลาที่กำหนด" },
    { pattern: /ไม่มีความเสี่ยง|ไม่เสี่ยง/, label: "อ้างว่าไม่มีความเสี่ยง" },
    { pattern: /คืนทุน\s*(ใน\s*)?\d+\s*(วัน|สัปดาห์|เดือน)/, label: "อ้างคืนทุนเป็นช่วงเวลา" },
  ],
  required: {
    label: "คำเตือนความเสี่ยงการลงทุน",
    patterns: [
      /การลงทุนมีความเสี่ยง/,
      /ผู้ลงทุนควรศึกษา(ข้อมูล|ข้อมูลก่อน)/,
      /ผลการดำเนินงาน(ในอดีต)?ไม่การันตี/,
    ],
    message:
      "การโฆษณาผลิตภัณฑ์การลงทุนต้องมีคำเตือน 'การลงทุนมีความเสี่ยง ผู้ลงทุนควรศึกษาข้อมูลก่อนตัดสินใจลงทุน' (ประกาศ ก.ล.ต.)",
  },
};
