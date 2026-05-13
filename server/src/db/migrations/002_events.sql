CREATE TABLE IF NOT EXISTS events (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        VARCHAR(255) NOT NULL,
  venue        VARCHAR(255) NOT NULL,
  description  TEXT,
  event_date   TIMESTAMP NOT NULL,
  total_seats  INTEGER NOT NULL,
  base_price   DECIMAL(10,2) NOT NULL,
  status       VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming','live','completed','cancelled')),
  created_at   TIMESTAMP DEFAULT NOW()
);