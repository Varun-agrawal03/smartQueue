ALTER TABLE events
  ADD COLUMN IF NOT EXISTS category VARCHAR(50)
  DEFAULT 'concert'
  CHECK (category IN ('concert','sports','movie','theatre','comedy','festival'));

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT DEFAULT '';

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS artist_or_team VARCHAR(255) DEFAULT '';