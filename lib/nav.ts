// Sidebar navigation — 12 destinations, Thai labels, ordered by guided workflow.
export interface NavItem {
  href: string;
  label: string;
  icon: string;
  group: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "แดชบอร์ด", icon: "🏠", group: "ภาพรวม" },
  { href: "/products", label: "สินค้า", icon: "🔍", group: "เวิร์กโฟลว์" },
  { href: "/campaigns", label: "แคมเปญ", icon: "🎯", group: "เวิร์กโฟลว์" },
  { href: "/content-studio", label: "สร้างคอนเทนต์", icon: "🎬", group: "เวิร์กโฟลว์" },
  { href: "/compliance", label: "ตรวจ Compliance", icon: "🛡️", group: "เวิร์กโฟลว์" },
  { href: "/publish-center", label: "ศูนย์เผยแพร่", icon: "🚀", group: "เวิร์กโฟลว์" },
  { href: "/calendar", label: "ปฏิทิน", icon: "📅", group: "เวิร์กโฟลว์" },
  { href: "/analytics", label: "วิเคราะห์ผล", icon: "📊", group: "ผลลัพธ์" },
  { href: "/revenue-forecast", label: "คาดการณ์รายได้", icon: "💰", group: "ผลลัพธ์" },
  { href: "/ai-advisor", label: "AI Advisor", icon: "🤖", group: "ผลลัพธ์" },
  { href: "/settings", label: "ตั้งค่า", icon: "⚙️", group: "ระบบ" },
  { href: "/settings/system", label: "ตั้งค่าระบบ", icon: "🛠️", group: "ระบบ" },
  { href: "/settings/team", label: "ทีม", icon: "👥", group: "ระบบ" },
];
