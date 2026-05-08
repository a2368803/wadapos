-- ============================================================
-- 餐廳備援點餐系統 — Supabase Schema
-- 執行順序：直接貼到 Supabase SQL Editor 執行
-- ============================================================

-- ─────────────────────────────────────
-- 1. 建立資料表
-- ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS categories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS items (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID        REFERENCES categories(id) ON DELETE SET NULL,
  name        TEXT        NOT NULL,
  price       NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  description TEXT,
  is_available BOOLEAN    NOT NULL DEFAULT TRUE,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number    BIGINT      GENERATED ALWAYS AS IDENTITY,
  order_type      TEXT        NOT NULL CHECK (order_type IN ('dine-in', 'takeout')),
  table_number    TEXT,
  pickup_number   TEXT,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'printed', 'completed', 'cancelled')),
  customer_note   TEXT,
  subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  created_by      TEXT        NOT NULL DEFAULT 'customer'
                              CHECK (created_by IN ('customer', 'staff')),
  idempotency_key TEXT        UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  printed_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS order_items (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id     UUID        REFERENCES items(id) ON DELETE SET NULL,
  item_name   TEXT        NOT NULL,
  item_price  NUMERIC(10,2) NOT NULL CHECK (item_price >= 0),
  quantity    INTEGER     NOT NULL CHECK (quantity > 0),
  item_note   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────
-- 2. 索引
-- ─────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_items_category    ON items (category_id);
CREATE INDEX IF NOT EXISTS idx_items_available   ON items (is_available);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created    ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);

-- ─────────────────────────────────────
-- 3. 啟用 RLS
-- ─────────────────────────────────────

ALTER TABLE categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────
-- 4. RLS 政策
-- ─────────────────────────────────────

-- categories: 公開讀取已啟用分類；管理員可完整操作
CREATE POLICY "public_read_active_categories" ON categories
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "admin_all_categories" ON categories
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- items: 公開讀取可用品項；管理員可完整操作
CREATE POLICY "public_read_available_items" ON items
  FOR SELECT USING (is_available = TRUE);

CREATE POLICY "admin_all_items" ON items
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- orders: 只有管理員可操作（客人透過 API Route + service_role 下單）
CREATE POLICY "admin_all_orders" ON orders
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- order_items: 只有管理員可操作
CREATE POLICY "admin_all_order_items" ON order_items
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─────────────────────────────────────
-- 5. Realtime — 讓管理後台可訂閱即時訂單
-- ─────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;

-- ─────────────────────────────────────
-- 6. 範例資料（可依實際菜單修改）
-- ─────────────────────────────────────

INSERT INTO categories (name, sort_order) VALUES
  ('主食', 1),
  ('小菜', 2),
  ('湯品', 3),
  ('飲料', 4),
  ('甜點', 5)
ON CONFLICT DO NOTHING;

INSERT INTO items (category_id, name, price, description, sort_order) VALUES
  ((SELECT id FROM categories WHERE name = '主食'), '白飯',     20,  NULL,         1),
  ((SELECT id FROM categories WHERE name = '主食'), '蛋炒飯',   80,  '香噴噴蛋炒飯', 2),
  ((SELECT id FROM categories WHERE name = '主食'), '排骨飯',   110, '嫩骨排骨',   3),
  ((SELECT id FROM categories WHERE name = '主食'), '滷肉飯',   65,  '古早味',     4),
  ((SELECT id FROM categories WHERE name = '主食'), '陽春麵',   55,  NULL,         5),
  ((SELECT id FROM categories WHERE name = '主食'), '炒麵',     75,  NULL,         6),
  ((SELECT id FROM categories WHERE name = '小菜'), '燙青菜',   40,  '依時令',     1),
  ((SELECT id FROM categories WHERE name = '小菜'), '滷蛋',     15,  '單顆',       2),
  ((SELECT id FROM categories WHERE name = '小菜'), '豆腐',     35,  '嫩豆腐',     3),
  ((SELECT id FROM categories WHERE name = '小菜'), '滷豬腳',   85,  '每份',       4),
  ((SELECT id FROM categories WHERE name = '湯品'), '蛋花湯',   30,  NULL,         1),
  ((SELECT id FROM categories WHERE name = '湯品'), '味噌湯',   30,  NULL,         2),
  ((SELECT id FROM categories WHERE name = '湯品'), '排骨湯',   60,  NULL,         3),
  ((SELECT id FROM categories WHERE name = '飲料'), '熱茶',     0,   '免費',       1),
  ((SELECT id FROM categories WHERE name = '飲料'), '冷開水',   0,   '免費',       2),
  ((SELECT id FROM categories WHERE name = '飲料'), '罐裝飲料', 30,  NULL,         3),
  ((SELECT id FROM categories WHERE name = '飲料'), '鮮榨果汁', 55,  '當日現榨',   4),
  ((SELECT id FROM categories WHERE name = '甜點'), '豆花',     45,  '糖水 / 薑汁', 1),
  ((SELECT id FROM categories WHERE name = '甜點'), '布丁',     40,  NULL,         2),
  ((SELECT id FROM categories WHERE name = '甜點'), '仙草凍',   35,  NULL,         3)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────
-- 完成！
-- 接下來：
--   1. 在 Supabase Auth > Users 建立管理員帳號
--   2. 將 URL 與 anon key 填入 .env.local
--   3. 將 service_role key 填入 .env.local（僅伺服器端使用）
-- ─────────────────────────────────────
