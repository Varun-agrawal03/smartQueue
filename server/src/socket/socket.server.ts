import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import redis from "../config/redis";

let io: Server;

export const initSocketServer = (httpServer: HttpServer): void => {
  io = new Server(httpServer, {
    cors: {
      origin: "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Client joins a room for a specific event
    socket.on("join_event", (eventId: string) => {
      socket.join(`event:${eventId}`);
      console.log(`📡 ${socket.id} joined event room: ${eventId}`);
    });

    // Client leaves event room
    socket.on("leave_event", (eventId: string) => {
      socket.leave(`event:${eventId}`);
      console.log(`📡 ${socket.id} left event room: ${eventId}`);
    });

    socket.on("disconnect", () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  // Subscribe to Redis pub/sub for price updates
  const subscriber = redis.duplicate();
  subscriber.subscribe("price_updates", (err) => {
    if (err) {
      console.error("❌ Redis subscriber error:", err);
      return;
    }
    console.log("✅ WebSocket subscribed to Redis price_updates channel");
  });

  subscriber.on("message", (_channel, message) => {
    const data = JSON.parse(message);
    const { eventId, newPrice, demandScore } = data;

    // Broadcast to all clients watching this event
    io.to(`event:${eventId}`).emit("price_updated", {
      eventId,
      newPrice,
      demandScore,
    });

    console.log(`📡 Broadcasted price update to event:${eventId} room`);
  });

  // Subscribe to seat updates
  const seatSubscriber = redis.duplicate();
  seatSubscriber.subscribe("seat_updates", (err) => {
    if (err) console.error("❌ Seat subscriber error:", err);
  });

  seatSubscriber.on("message", (_channel, message) => {
    const data = JSON.parse(message);
    const { eventId, seatId, status } = data;

    io.to(`event:${eventId}`).emit("seat_updated", {
      seatId,
      status,
    });
  });
};

export const getIO = (): Server => {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
};