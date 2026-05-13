import { query } from "../db/index";

export interface CreateEventInput {
  title: string;
  venue: string;
  description: string;
  event_date: string;
  total_seats: number;
  base_price: number;
  rows: number;
  seats_per_row: number;
}

// Create event + auto-generate all seats
export const createEvent = async (input: CreateEventInput) => {
  const {
    title,
    venue,
    description,
    event_date,
    total_seats,
    base_price,
    rows,
    seats_per_row,
  } = input;

  // Insert event
  const eventResult = await query(
    `INSERT INTO events (title, venue, description, event_date, total_seats, base_price, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'upcoming')
     RETURNING *`,
    [title, venue, description, event_date, total_seats, base_price]
  );

  const event = eventResult.rows[0];

  // Auto-generate seats (e.g. A1, A2, B1, B2...)
  const rowLabels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const seatInserts: Promise<unknown>[] = [];

  for (let r = 0; r < rows; r++) {
    for (let s = 1; s <= seats_per_row; s++) {
      const row_label = rowLabels[r];
      const seat_number = `${row_label}${s}`;
      seatInserts.push(
        query(
          `INSERT INTO seats (event_id, seat_number, row_label, status)
           VALUES ($1, $2, $3, 'available')`,
          [event.id, seat_number, row_label]
        )
      );
    }
  }

  await Promise.all(seatInserts);

  return event;
};

// Get all events
export const getAllEvents = async () => {
  const result = await query(
    `SELECT id, title, venue, description, event_date, 
            total_seats, base_price, status, created_at
     FROM events
     ORDER BY event_date ASC`
  );
  return result.rows;
};

// Get single event by ID
export const getEventById = async (eventId: string) => {
  const result = await query(
    `SELECT id, title, venue, description, event_date,
            total_seats, base_price, status, created_at
     FROM events WHERE id = $1`,
    [eventId]
  );

  if (result.rows.length === 0) {
    throw new Error("Event not found");
  }

  return result.rows[0];
};

// Get seats for an event
export const getEventSeats = async (eventId: string) => {
  const result = await query(
    `SELECT id, seat_number, row_label, status, locked_until
     FROM seats
     WHERE event_id = $1
     ORDER BY row_label ASC, seat_number ASC`,
    [eventId]
  );
  return result.rows;
};