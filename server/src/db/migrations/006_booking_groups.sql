CREATE TABLE IF NOT EXISTS booking_groups (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id),
  event_id     UUID NOT NULL REFERENCES events(id),
  total_seats  INTEGER NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status       VARCHAR(20) DEFAULT 'confirmed'
              CHECK (status IN ('confirmed','cancelled','pending')),
  created_at   TIMESTAMP DEFAULT NOW()
);

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS booking_group_id UUID
  REFERENCES booking_groups(id);