import { query } from "../db/index";
import { acquireLock, releaseLock } from "./lock.service";
import redis from "../config/redis";
import { publishEvent } from "../kafka/producer";

export interface BookingInput {
  userId: string;
  seatId: string;
  eventId: string;
}

export const createBooking = async (input: BookingInput) => {
  const { userId, seatId, eventId } = input;

  const lockAcquired = await acquireLock(seatId);
  if (!lockAcquired) throw new Error("SEAT_LOCKED");

  try {
    const seatResult = await query(
      "SELECT id, status, event_id FROM seats WHERE id = $1",
      [seatId]
    );

    if (seatResult.rows.length === 0) throw new Error("SEAT_NOT_FOUND");

    const seat = seatResult.rows[0];
    if (seat.status !== "available") throw new Error("SEAT_UNAVAILABLE");
    if (seat.event_id !== eventId) throw new Error("SEAT_EVENT_MISMATCH");

    const cachedPrice = await redis.get(`price:event:${eventId}`);
    let pricePaid: number;

    if (cachedPrice) {
      pricePaid = parseFloat(cachedPrice);
    } else {
      const eventResult = await query(
        "SELECT base_price FROM events WHERE id = $1",
        [eventId]
      );
      pricePaid = parseFloat(eventResult.rows[0].base_price);
    }

    await query("BEGIN");
    await query("UPDATE seats SET status = 'booked' WHERE id = $1", [seatId]);

    const bookingResult = await query(
      `INSERT INTO bookings (user_id, seat_id, event_id, price_paid, status)
       VALUES ($1, $2, $3, $4, 'confirmed')
       RETURNING *`,
      [userId, seatId, eventId, pricePaid]
    );

    await query("COMMIT");

    await redis.del(`seats:event:${eventId}`);

    const booking = bookingResult.rows[0];

    // Publish to Kafka → triggers pricing engine
    await publishEvent("booking-confirmed", {
      eventId,
      seatId,
      userId,
      price: pricePaid,
      bookingId: booking.id,
    });

    // Publish seat status to Redis → triggers WebSocket broadcast
    await redis.publish(
      "seat_updates",
      JSON.stringify({ eventId, seatId, status: "booked" })
    );

    return booking;

  } catch (err) {
    await query("ROLLBACK");
    throw err;
  } finally {
    await releaseLock(seatId);
  }
};

export const getUserBookings = async (userId: string) => {
  const result = await query(
    `SELECT
       b.id, b.price_paid, b.status, b.booked_at,
       e.title as event_title, e.venue, e.event_date,
       s.seat_number, s.row_label
     FROM bookings b
     JOIN events e ON b.event_id = e.id
     JOIN seats s ON b.seat_id = s.id
     WHERE b.user_id = $1
     ORDER BY b.booked_at DESC`,
    [userId]
  );
  return result.rows;
};