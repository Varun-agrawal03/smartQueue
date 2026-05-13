import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = "http://localhost:5000";

export const useSocket = (
  eventId: string | null,
  handlers: {
    onPriceUpdated?: (data: {
      eventId: string;
      newPrice: number;
      demandScore: number;
    }) => void;
    onSeatUpdated?: (data: { seatId: string; status: string }) => void;
  }
) => {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!eventId) return;

    socketRef.current = io(SOCKET_URL, {
      transports: ["websocket"],
    });

    const socket = socketRef.current;

    socket.on("connect", () => {
      console.log("🔌 WebSocket connected");
      socket.emit("join_event", eventId);
    });

    if (handlers.onPriceUpdated) {
      socket.on("price_updated", handlers.onPriceUpdated);
    }

    if (handlers.onSeatUpdated) {
      socket.on("seat_updated", handlers.onSeatUpdated);
    }

    socket.on("disconnect", () => {
      console.log("🔌 WebSocket disconnected");
    });

    return () => {
      socket.emit("leave_event", eventId);
      socket.disconnect();
    };
  }, [eventId]);
};