-- 0010 — Optional demo seed. Safe to skip in production.
-- Creates a demo workspace with sample products + campaign so the UI has data
-- before any real signup. Uses a fixed UUID owner placeholder; real workspaces
-- are created by the handle_new_user() trigger on signup.

do $$
declare
  demo_ws uuid := '00000000-0000-0000-0000-0000000000d0';
begin
  if not exists (select 1 from workspaces where id = demo_ws) then
    insert into workspaces (id, name, owner_id, plan)
    select demo_ws, 'CreatorOS Demo', id, 'demo'
    from auth.users limit 1;

    -- Only seed if we found a user to own it.
    if exists (select 1 from workspaces where id = demo_ws) then
      insert into settings (workspace_id, data)
      values (demo_ws, '{"monthly_revenue_target": 50000}'::jsonb)
      on conflict (workspace_id) do nothing;

      insert into products (workspace_id, source_platform, name, price, commission_rate, score, tier)
      values
        (demo_ws, 'shopee', 'ครีมกันแดด SPF50 สูตรบางเบา', 259, 12, 86, 'hero'),
        (demo_ws, 'tiktok', 'หูฟังบลูทูธไร้สาย รุ่นตัดเสียงรบกวน', 690, 8, 72, 'growth'),
        (demo_ws, 'manual', 'ขวดน้ำเก็บอุณหภูมิ 500ml', 199, 15, 55, 'test');
    end if;
  end if;
end;
$$;
