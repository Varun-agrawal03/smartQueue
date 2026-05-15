import { query } from "../db/index";
import { acquireLock, releaseLock } from "./lock.service";
import redis from "../config/redis";
import { publishEvent } from "../kafka/producer";

export interface BookingInput {
  userId: string;
  seatIds: string[];       // ← array now
  eventId: string;
}

export interface SingleSeatResult {
  seatId: string;
  seatNumber: string;
  rowLabel: string;
  pricePaid: number;
  bookingId: string;
  status: "confirmed" | "failed";
  reason?: string;
}

export interface MultiBookingResult {
  groupId: string;
  totalSeats: number;
  totalAmount: number;
  seats: SingleSeatResult[];
  failedSeats: SingleSeatResult[];
}

export const createMultiBooking = async (
  input: BookingInput
): Promise<MultiBookingResult> => {
  const { userId, seatIds, eventId } = input;

  if (seatIds.length === 0) throw new Error("NO_SEATS_SELECTED");
  if (seatIds.length > 6)  throw new Error("MAX_6_SEATS_PER_BOOKING");

  // Get current price once for all seats
  const cachedPrice = await redis.get(`price:event:${eventId}`);
  let pricePerSeat: number;

  if (cachedPrice) {
    pricePerSeat = parseFloat(cachedPrice);
  } else {
    const eventResult = await query(
      "SELECT base_price FROM events WHERE id = $1",
      [eventId]
    );
    if (eventResult.rows.length === 0) throw new Error("EVENT_NOT_FOUND");
    pricePerSeat = parseFloat(eventResult.rows[0].base_price);
  }

  const confirmedSeats: SingleSeatResult[] = [];
  const failedSeats: SingleSeatResult[] = [];
  const acquiredLocks: string[] = [];

  try {
    // Step 1 — acquire locks on ALL seats first
    for (const seatId of seatIds) {
      const locked = await acquireLock(seatId);
      if (locked) {
        acquiredLocks.push(seatId);
      } else {
        failedSeats.push({
          seatId,
          seatNumber: "",
          rowLabel: "",
          pricePaid: 0,
          bookingId: "",
          status: "failed",
          reason: "SEAT_LOCKED",
        });
      }
    }

    const lockedSeatIds = acquiredLocks;

    if (lockedSeatIds.length === 0) {
      throw new Error("ALL_SEATS_LOCKED");
    }

    // Step 2 — verify all locked seats are available
    const seatCheck = await query(
      `SELECT id, seat_number, row_label, status, event_id
       FROM seats WHERE id = ANY($1::uuid[])`,
      [lockedSeatIds]
    );

    const availableSeats = seatCheck.rows.filter(
      (s) => s.status === "available" && s.event_id === eventId
    );

    const unavailableIds = lockedSeatIds.filter(
      (id) => !availableSeats.find((s) => s.id === id)
    );

    unavailableIds.forEach((seatId) => {
      failedSeats.push({
        seatId,
        seatNumber: "",
        rowLabel: "",
        pricePaid: 0,
        bookingId: "",
        status: "failed",
        reason: "SEAT_UNAVAILABLE",
      });
    });

    if (availableSeats.length === 0) {
      throw new Error("NO_AVAILABLE_SEATS");
    }

    // Step 3 — create booking group first
    const totalAmount = pricePerSeat * availableSeats.length;

    await query("BEGIN");

    const groupResult = await query(
      `INSERT INTO booking_groups
         (user_id, event_id, total_seats, total_amount, status)
       VALUES ($1, $2, $3, $4, 'confirmed')
       RETURNING id`,
      [userId, eventId, availableSeats.length, totalAmount]
    );

    const groupId = groupResult.rows[0].id;

    // Step 4 — book each available seat
    for (const seat of availableSeats) {
      await query(
        "UPDATE seats SET status = 'booked' WHERE id = $1",
        [seat.id]
      );

      const bookingResult = await query(
        `INSERT INTO bookings
           (user_id, seat_id, event_id, price_paid, status, booking_group_id)
         VALUES ($1, $2, $3, $4, 'confirmed', $5)
         RETURNING id`,
        [userId, seat.id, eventId, pricePerSeat, groupId]
      );

      confirmedSeats.push({
        seatId:     seat.id,
        seatNumber: seat.seat_number,
        rowLabel:   seat.row_label,
        pricePaid:  pricePerSeat,
        bookingId:  bookingResult.rows[0].id,
        status:     "confirmed",
      });
    }

    await query("COMMIT");

    // Step 5 — invalidate cache
    await redis.del(`seats:event:${eventId}`);

    // Step 6 — publish Kafka event for each confirmed seat
    for (const seat of confirmedSeats) {
      await publishEvent("booking-confirmed", {
        eventId,
        seatId:    seat.seatId,
        userId,
        price:     seat.pricePaid,
        bookingId: seat.bookingId,
        groupId,
      });

      await redis.publish(
        "seat_updates",
        JSON.stringify({ eventId, seatId: seat.seatId, status: "booked" })
      );
    }

    return {
      groupId,
      totalSeats:  confirmedSeats.length,
      totalAmount,
      seats:       confirmedSeats,
      failedSeats,
    };

  } catch (err) {
    await query("ROLLBACK");
    throw err;
  } finally {
    // Always release all locks
    for (const seatId of acquiredLocks) {
      await releaseLock(seatId);
    }
  }
};

export const getUserBookings = async (userId: string) => {
  const result = await query(
    `SELECT
       b.id, b.price_paid, b.status, b.booked_at,
       b.booking_group_id,
       e.title      AS event_title,
       e.venue,
       e.event_date,
       s.seat_number,
       s.row_label
     FROM bookings b
     JOIN events e ON b.event_id  = e.id
     JOIN seats  s ON b.seat_id   = s.id
     WHERE b.user_id = $1
     ORDER BY b.booked_at DESC`,
    [userId]
  );
  return result.rows;
};

export const getUserBookingGroups = async (userId: string) => {
  const result = await query(
    `SELECT
       bg.id, bg.total_seats, bg.total_amount,
       bg.status, bg.created_at,
       e.title AS event_title, e.venue, e.event_date,
       json_agg(json_build_object(
         'booking_id',  b.id,
         'seat_number', s.seat_number,
         'row_label',   s.row_label,
         'price_paid',  b.price_paid
       ) ORDER BY s.row_label, s.seat_number) AS seats
     FROM booking_groups bg
     JOIN events  e ON bg.event_id = e.id
     JOIN bookings b ON b.booking_group_id = bg.id
     JOIN seats   s ON b.seat_id = s.id
     WHERE bg.user_id = $1
     GROUP BY bg.id, e.title, e.venue, e.event_date
     ORDER BY bg.created_at DESC`,
    [userId]
  );
  return result.rows;
};