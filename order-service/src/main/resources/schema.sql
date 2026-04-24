-- Drop stale enum check constraints so Hibernate can recreate them with the new values.
-- IF EXISTS makes this safe on a fresh database (no-op if constraints don't exist yet).
ALTER TABLE IF EXISTS stock_orders DROP CONSTRAINT IF EXISTS stock_orders_status_check;
ALTER TABLE IF EXISTS stock_orders DROP CONSTRAINT IF EXISTS stock_orders_order_mode_check;
ALTER TABLE IF EXISTS stock_orders DROP CONSTRAINT IF EXISTS stock_orders_type_check;
