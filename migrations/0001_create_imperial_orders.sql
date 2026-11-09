CREATE TABLE IF NOT EXISTS imperial_orders (
  id TEXT PRIMARY KEY,
  order_number INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'חדש',
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  event_type TEXT,
  event_date TEXT,
  guests INTEGER,
  location TEXT,
  address TEXT,
  notes TEXT,
  items_json TEXT NOT NULL DEFAULT '[]',
  contract_json TEXT,
  whatsapp_opened INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_imperial_orders_created_at ON imperial_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_imperial_orders_event_date ON imperial_orders(event_date);
