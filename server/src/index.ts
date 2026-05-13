import express from "express";
import cors from "cors";
import http from "http";
import { ENV } from "./config/env";
import "./db/index";
import "./config/redis";
import authRoutes from "./routes/auth.routes";
import eventRoutes from "./routes/event.routes";
import bookingRoutes from "./routes/booking.routes";
import { startBookingWorker } from "./workers/booking.worker";
import { connectProducer } from "./kafka/producer";
import { startPricingConsumer } from "./kafka/consumer";
import { startEmailConsumer } from "./kafka/emailConsumer";
import { initSocketServer } from "./socket/socket.server";

const app = express();
const httpServer = http.createServer(app);

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/bookings", bookingRoutes);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const bootstrap = async () => {
  // Init WebSocket server
  initSocketServer(httpServer);

  // Start BullMQ worker
  startBookingWorker();

  // Connect Kafka producer
  await connectProducer();

  // Start pricing engine consumer
  await startPricingConsumer();
  await startEmailConsumer(); 

  httpServer.listen(ENV.PORT, () => {
    console.log(`🚀 Server running on http://localhost:${ENV.PORT}`);
  });
};

bootstrap().catch((err) => {
  console.error("❌ Bootstrap failed:", err);
  process.exit(1);
});

export { httpServer };