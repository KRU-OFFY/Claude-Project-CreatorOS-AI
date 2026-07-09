# วิเคราะห์ข้อผิดพลาดของโครงสร้างระบบเดิม

## 1. Shopee-first Architecture
### ปัญหา
ระบบเดิมผูกกับ Shopee มากเกินไป ทำให้เพิ่ม Facebook, Instagram, TikTok, X, YouTube, Lemon8 ได้ยาก

### แก้ไข
เปลี่ยนเป็น Platform-agnostic Architecture โดยใช้ Platform Adapter Layer

---

## 2. Flow ผู้ใช้กระจัดกระจาย
### ปัญหา
ผู้ใช้ต้องเข้า Products, Projects, Preview, Approval, Queue แยกกัน ทำให้ไม่รู้ว่าขั้นตอนถัดไปคืออะไร

### แก้ไข
ใช้ Guided Workflow:
Product → Campaign → AI Content → Compliance → Channel Selection → Calendar → Publish → Analytics

---

## 3. Auth / Session ยังไม่ครบ
### ปัญหา
Edge Functions ต้องใช้ JWT แต่ Frontend ยังไม่มี session guard ครบ

### แก้ไข
เพิ่ม Supabase Auth, middleware, protected routes, workspace และ role

---

## 4. Vercel Serverless ไม่เหมาะกับ ffmpeg/filesystem
### ปัญหา
TTS/Render เคยเกิด ENOENT เพราะใช้ temp files และ ffmpeg บน runtime

### แก้ไข
MVP ใช้ serverless-safe preview และให้ real MP4 render ผ่าน Render Worker + Supabase Storage

---

## 5. ไม่มี Connector Layer จริง
### ปัญหา
ระบบยังไม่มีการดึงข้อมูลจริงจาก social platform

### แก้ไข
สร้าง Connector Layer:
Meta, TikTok, YouTube, X, Lemon8, Shopee

---

## 6. Analytics ยังไม่ unified
### ปัญหา
แต่ละแพลตฟอร์มมี metric ต่างกัน ทำให้สรุป KPI ยาก

### แก้ไข
สร้าง Unified Analytics Model:
views, reach, engagement, clicks, orders, revenue, commission, ROI

---

## 7. Compliance ยังไม่แยกตาม Platform
### ปัญหา
Facebook, TikTok, YouTube, Shopee มีกฎ disclosure และ claim ต่างกัน

### แก้ไข
สร้าง Platform-specific Compliance Rules และ AI Rewrite ก่อนเผยแพร่

---

## 8. ขาด Pre-build Audit
### ปัญหา
AI Builder อาจเริ่มเขียนโค้ดทันทีโดยไม่ตรวจช่องโหว่

### แก้ไข
บังคับ Claude Code ทำ Architecture Audit ก่อนสร้างระบบ
