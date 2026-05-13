import { Kafka, logLevel } from "kafkajs";
import { ENV } from "../config/env";
import redis from "../config/redis";
import { query } from "../db/index";

const kafka = new Kafka({
  clientId: "smartqueue-consumer",
  brokers: [ENV.KAFKA.broker],
  logLevel: logLevel.WARN,
});

interface BookingEvent {
  eventId: string;
  seatId: string;
  userId: string;
  price: number;
}

const calculateSurgePrice = async (eventId: string): Promise<number> => {
  // Get event base price + total seats
  const eventResult = await query(
    "SELECT base_price, total_seats FROM events WHERE id = $1",
    [eventId]
  );

  if (eventResult.rows.length === 0) return 0;

  const { base_price, total_seats } = eventResult.rows[0];

  // Count bookings in last 5 minutes
  const recentBookings = await query(
    `SELECT COUNT(*) as count FROM bookings
     WHERE event_id = $1
     AND booked_at > NOW() - INTERVAL '5 minutes'`,
    [eventId]
  );

  const recentCount = parseInt(recentBookings.rows[0].count);

  // demand score = recent bookings / total seats (0 to 1)
  const demandScore = Math.min(recentCount / total_seats, 1);

  // surge formula: base * (1 + demand * 0.5)
  // at 0% demand → base price
  // at 100% demand → 1.5x base price
  const surgePrice = parseFloat(base_price) * (1 + demandScore * 0.5);

  // Cap at 2x base price
  const finalPrice = Math.min(surgePrice, parseFloat(base_price) * 2);

  return Math.round(finalPrice * 100) / 100; // round to 2 decimals
};

export const startPricingConsumer = async (): Promise<void> => {
  const consumer = kafka.consumer({ groupId: "pricing-group" });

  await consumer.connect();
  console.log("✅ Kafka consumer connected");

  await consumer.subscribe({
    topic: "booking-confirmed",
    fromBeginning: false,
  });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;

      const event: BookingEvent = JSON.parse(message.value.toString());
      console.log(`📨 Pricing engine received booking for event: ${event.eventId}`);

      try {
        const newPrice = await calculateSurgePrice(event.eventId);
        const demandResult = await query(
          `SELECT COUNT(*) as count FROM bookings
           WHERE event_id = $1
           AND booked_at > NOW() - INTERVAL '5 minutes'`,
          [event.eventId]
        );
        const eventMeta = await query(
          "SELECT total_seats FROM events WHERE id = $1",
          [event.eventId]
        );

        const recentCount = parseInt(demandResult.rows[0].count);
        const totalSeats = parseInt(eventMeta.rows[0].total_seats);
        const demandScore = Math.min(recentCount / totalSeats, 1);

        // Update Redis with new price + demand score
        await redis.set(`price:event:${event.eventId}`, newPrice.toString());
        await redis.set(
          `demand:event:${event.eventId}`,
          demandScore.toFixed(2)
        );

        // Save snapshot to DB
        await query(
          `INSERT INTO price_snapshots (event_id, price, demand_score)
           VALUES ($1, $2, $3)`,
          [event.eventId, newPrice, demandScore]
        );

        console.log(
          `💰 Surge price updated → ₹${newPrice} (demand: ${(demandScore * 100).toFixed(0)}%)`
        );

        // Publish to Redis pub/sub so WebSocket can broadcast
        await redis.publish(
          "price_updates",
          JSON.stringify({
            eventId: event.eventId,
            newPrice,
            demandScore,
          })
        );
      } catch (err) {
        console.error("❌ Pricing engine error:", err);
      }
    },
  });
};