
ALTER TABLE public.investments
  ADD COLUMN IF NOT EXISTS asset_symbol text,
  ADD COLUMN IF NOT EXISTS entry_price numeric;
