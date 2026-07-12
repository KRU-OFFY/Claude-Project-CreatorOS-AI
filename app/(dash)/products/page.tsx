import { PageHeader, Card, TierBadge, EmptyState, Th, Td } from "@/components/ui";
import { listProducts } from "@/lib/data";
import { createProduct } from "../actions";
import { CAMPAIGN_MIN_SCORE } from "@/lib/scoring/product-score";

export default async function ProductsPage() {
  const products = await listProducts();

  return (
    <div>
      <PageHeader
        title="Product Intelligence"
        subtitle="ค้นหา/เพิ่มสินค้า · AI ให้คะแนนโอกาสทำเงิน · จัดกลุ่ม Hero/Growth/Test/Watchlist"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <h2 className="mb-3 font-semibold">เพิ่มสินค้า</h2>
          <form action={createProduct} className="space-y-3">
            <Field name="name" label="ชื่อสินค้า" required />
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground/60">
                ลิงก์ Affiliate (เช่น https://s.shopee.co.th/xxx)
              </label>
              <input
                name="url"
                type="url"
                placeholder="https://s.shopee.co.th/xxx"
                className="w-full rounded-lg border border-white/15 px-3 py-2 text-sm outline-none focus:border-brand"
              />
              <p className="mt-1 text-[11px] text-foreground/40">
                ระบบจะวางลิงก์ให้อัตโนมัติตอนโพสต์ — Facebook เป็นคอมเมนต์แรก
                แพลตฟอร์มอื่นต่อท้ายแคปชั่น
              </p>
            </div>
            <Field name="price" label="ราคา (บาท)" type="number" />
            <Field name="commission_rate" label="ค่าคอมมิชชั่น (%)" type="number" />
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground/60">แหล่งที่มา</label>
              <select
                name="source_platform"
                className="w-full rounded-lg border border-white/15 px-3 py-2 text-sm"
              >
                <option value="manual">กรอกเอง</option>
                <option value="shopee">Shopee</option>
                <option value="tiktok">TikTok</option>
                <option value="lazada">Lazada</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground/60">
                หมวดหมู่ (เพื่อตรวจกฎเฉพาะ)
              </label>
              <select
                name="product_category"
                defaultValue="general"
                className="w-full rounded-lg border border-white/15 px-3 py-2 text-sm"
              >
                <option value="general">ทั่วไป</option>
                <option value="health">อาหารเสริม/สุขภาพ (อย.)</option>
                <option value="cosmetics">เครื่องสำอาง (อย.)</option>
                <option value="financial">การเงิน/การลงทุน (ก.ล.ต.)</option>
              </select>
              <p className="mt-1 text-[11px] text-foreground/40">
                เลือกให้ตรง — Compliance Gate จะตรวจกฎของหน่วยงานกำกับตามหมวดที่เลือก
              </p>
            </div>
            <button className="w-full rounded-lg bg-gradient-to-r from-brand to-brand-2 px-3 py-2 text-sm font-semibold text-white">
              เพิ่ม + ให้ AI คะแนน
            </button>
          </form>
          <p className="mt-3 text-xs text-foreground/40">
            สินค้าที่คะแนน ≥ {CAMPAIGN_MIN_SCORE} จึงจะแนะนำให้สร้างแคมเปญ
          </p>
        </Card>

        <Card className="md:col-span-2">
          <h2 className="mb-3 font-semibold">รายการสินค้า ({products.length})</h2>
          {products.length === 0 ? (
            <EmptyState>ยังไม่มีสินค้า — เพิ่มสินค้าแรกทางซ้าย</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <Th>สินค้า</Th>
                    <Th>ราคา</Th>
                    <Th>คอม %</Th>
                    <Th>คะแนน</Th>
                    <Th>Tier</Th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <Td>{p.name}</Td>
                      <Td>{p.price ?? "—"}</Td>
                      <Td>{p.commission_rate ?? "—"}</Td>
                      <Td>{p.score ?? "—"}</Td>
                      <Td>
                        <TierBadge tier={p.tier} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-foreground/60">{label}</label>
      <input
        name={name}
        type={type}
        required={required}
        step="any"
        className="w-full rounded-lg border border-white/15 px-3 py-2 text-sm outline-none focus:border-brand"
      />
    </div>
  );
}
