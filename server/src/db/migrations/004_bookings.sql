CREATE TABLE IF NOT EXISTS bookings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id),
  seat_id     UUID NOT NULL REFERENCES seats(id),
  event_id    UUID NOT NULL REFERENCES events(id),
  price_paid  DECIMAL(10,2) NOT NULL,
  status      VARCHAR(20) DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled','pending')),
  booked_at   TIMESTAMP DEFAULT NOW()
);