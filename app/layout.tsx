import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CreatorOS AI — One AI. Every Platform.",
  description:
    "AI Operating System สำหรับ Creator และ Affiliate — ค้นหา วิเคราะห์ สร้างคอนเทนต์ โปรโมทหลายแพลตฟอร์ม วิเคราะห์ผล และเพิ่มรายได้ในระบบเดียว",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className="antialiased">{children}</body>
    </html>
  );
}
