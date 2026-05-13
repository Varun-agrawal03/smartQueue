CREATE TABLE IF NOT EXISTS price_snapshots (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id     UUID NOT NULL REFERENCES events(id),
  price        DECIMAL(10,2) NOT NULL,
  demand_score FLOAT NOT NULL DEFAULT 0,
  recorded_at  TIMESTAMP DEFAULT NOW()
);