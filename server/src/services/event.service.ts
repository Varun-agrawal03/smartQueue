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
  category?: string;
  thumbnail_url?: string;
  artist_or_team?: string;
}

export const createEvent = async (input: CreateEventInput) => {
  const {
    title, venue, description, event_date,
    total_seats, base_price, rows, seats_per_row,
    category = "concert",
    thumbnail_url = "",
    artist_or_team = "",
  } = input;

  const eventResult = await query(
    `INSERT INTO events
       (title, venue, description, event_date, total_seats,
        base_price, status, category, thumbnail_url, artist_or_team)
     VALUES ($1,$2,$3,$4,$5,$6,'upcoming',$7,$8,$9)
     RETURNING *`,
    [title, venue, description, event_date, total_seats,
     base_price, category, thumbnail_url, artist_or_team]
  );

  const event = eventResult.rows[0];

  const rowLabels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const seatInserts: Promise<unknown>[] = [];

  for (let r = 0; r < rows; r++) {
    for (let s = 1; s <= seats_per_row; s++) {
      const row_label   = rowLabels[r];
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

export const getAllEvents = async () => {
  const result = await query(
    `SELECT id, title, venue, description, event_date,
            total_seats, base_price, status, category,
            thumbnail_url, artist_or_team, created_at
     FROM events
     ORDER BY event_date ASC`
  );
  return result.rows;
};

export const getEventsByCategory = async (category: string) => {
  const result = await query(
    `SELECT id, title, venue, description, event_date,
            total_seats, base_price, status, category,
            thumbnail_url, artist_or_team, created_at
     FROM events
     WHERE category = $1
     ORDER BY event_date ASC`,
    [category]
  );
  return result.rows;
};

export const getEventById = async (eventId: string) => {
  const result = await query(
    `SELECT id, title, venue, description, event_date,
            total_seats, base_price, status, category,
            thumbnail_url, artist_or_team, created_at
     FROM events WHERE id = $1`,
    [eventId]
  );
  if (result.rows.length === 0) throw new Error("Event not found");
  return result.rows[0];
};

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

export const getLandingPageEvents = async () => {
  const result = await query(
    `SELECT
       e.id, e.title, e.venue, e.event_date,
       e.base_price, e.status, e.category,
       e.thumbnail_url, e.artist_or_team,
       COUNT(s.id) FILTER (WHERE s.status = 'available') AS available_seats,
       COUNT(s.id) AS total_seats
     FROM events e
     LEFT JOIN seats s ON s.event_id = e.id
     WHERE e.status != 'cancelled'
     GROUP BY e.id
     ORDER BY e.event_date ASC`
  );
  return result.rows;
};