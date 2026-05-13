import { Kafka, logLevel } from "kafkajs";
import { ENV } from "../config/env";
import { query } from "../db/index";
import { sendBookingConfirmationEmail } from "../services/email.service";

const kafka = new Kafka({
  clientId: "smartqueue-email-consumer",
  brokers: [ENV.KAFKA.broker],
  logLevel: logLevel.WARN,
});

interface BookingConfirmedEvent {
  eventId: string;
  seatId: string;
  userId: string;
  price: number;
  bookingId: string;
}

export const startEmailConsumer = async (): Promise<void> => {
  const consumer = kafka.consumer({ groupId: "email-notification-group" });

  await consumer.connect();
  console.log("✅ Email Kafka consumer connected");

  await consumer.subscribe({
    topic: "booking-confirmed",
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;

      const event: BookingConfirmedEvent = JSON.parse(
        message.value.toString()
      );

      console.log(`📧 Email consumer: processing booking ${event.bookingId}`);

      try {
        // Fetch all data needed for the email in one query
        const result = await query(
          `SELECT
             u.name        AS user_name,
             u.email       AS user_email,
             e.title       AS event_title,
             e.venue       AS venue,
             e.event_date  AS event_date,
             s.seat_number AS seat_number,
             s.row_label   AS row_label,
             b.price_paid  AS price_paid,
             b.id          AS booking_id
           FROM bookings b
           JOIN users  u ON b.user_id   = u.id
           JOIN events e ON b.event_id  = e.id
           JOIN seats  s ON b.seat_id   = s.id
           WHERE b.id = $1`,
          [event.bookingId]
        );

        if (result.rows.length === 0) {
          console.warn(`⚠️ Booking ${event.bookingId} not found for email`);
          return;
        }

        const row = result.rows[0];

        await sendBookingConfirmationEmail({
          toEmail:    row.user_email,
          toName:     row.user_name,
          eventTitle: row.event_title,
          venue:      row.venue,
          eventDate:  row.event_date,
          seatNumber: row.seat_number,
          rowLabel:   row.row_label,
          pricePaid:  row.price_paid,
          bookingId:  row.booking_id,
        });

      } catch (err) {
        console.error("❌ Email consumer error:", err);
      }
    },
  });
};