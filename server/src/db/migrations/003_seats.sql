CREATE TABLE IF NOT EXISTS seats (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id     UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  seat_number  VARCHAR(10) NOT NULL,
  row_label    VARCHAR(5) NOT NULL,
  status       VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available','locked','booked')),
  locked_until TIMESTAMP,
  created_at   TIMESTAMP DEFAULT NOW(),
  UNIQUE(event_id, seat_number)
);