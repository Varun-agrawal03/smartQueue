import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useSocket } from "../hooks/useSocket";
import type { EventType, Seat } from "../types";

const EventDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [event, setEvent] = useState<EventType | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  const MAX_SEATS = 6;
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [bookingStatus, setBookingStatus] = useState<
    "idle" | "queued" | "success" | "error"
  >("idle");
  const [bookingMessage, setBookingMessage] = useState("");
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [demandScore, setDemandScore] = useState<number>(0);

  // WebSocket — live updates
  useSocket(id || null, {
    onPriceUpdated: (data) => {
      setCurrentPrice(data.newPrice);
      setDemandScore(data.demandScore);
    },
    onSeatUpdated: (data) => {
      setSeats((prev) =>
        prev.map((s) =>
          s.id === data.seatId
            ? { ...s, status: data.status as Seat["status"] }
            : s,
        ),
      );
      // Remove from selected if someone else booked it
      setSelectedSeats((prev) => {
        const wasSelected = prev.find((s) => s.id === data.seatId);
        if (wasSelected) {
          setBookingMessage("⚠️ One of your selected seats was just booked!");
          return prev.filter((s) => s.id !== data.seatId);
        }
        return prev;
      });
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eventRes, seatsRes] = await Promise.all([
          api.get(`/events/${id}`),
          api.get(`/events/${id}/seats`),
        ]);
        setEvent(eventRes.data.event);
        setCurrentPrice(
          eventRes.data.event.current_price || eventRes.data.event.base_price,
        );
        setDemandScore(eventRes.data.event.demand_score || 0);
        setSeats(seatsRes.data.seats);
      } catch (err) {
        console.error("Failed to fetch event:", err);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchData();
  }, [id]);

  const handleSeatClick = (seat: Seat) => {
    if (seat.status !== "available") return;

    setSelectedSeats((prev) => {
      const isSelected = prev.find((s) => s.id === seat.id);
      if (isSelected) {
        return prev.filter((s) => s.id !== seat.id);
      }
      if (prev.length >= MAX_SEATS) {
        setBookingMessage(`⚠️ Maximum ${MAX_SEATS} seats per booking`);
        return prev;
      }
      return [...prev, seat];
    });

    setBookingMessage("");
    setBookingStatus("idle");
  };

  const handleBooking = async () => {
    if (selectedSeats.length === 0 || !id) return;
    setBooking(true);
    setBookingStatus("queued");
    setBookingMessage("Adding to queue...");

    try {
      const res = await api.post("/bookings", {
        seatIds: selectedSeats.map((s) => s.id),
        eventId: id,
      });

      const jobId = res.data.jobId;
      setBookingMessage(`Processing ${selectedSeats.length} seat(s)...`);

      const poll = setInterval(async () => {
        try {
          const jobRes = await api.get(`/bookings/job/${jobId}`);
          const { state, result, failReason } = jobRes.data;

          if (state === "completed" && result) {
            clearInterval(poll);
            setBookingStatus("success");
            const confirmed = result.seats.length;
            const failed = result.failedSeats.length;
            setBookingMessage(
              `✅ ${confirmed} seat(s) booked for ₹${Number(result.totalAmount).toLocaleString()}!` +
                (failed > 0 ? ` (${failed} seat(s) unavailable)` : ""),
            );
            setSelectedSeats([]);
            setBooking(false);
            const seatsRes = await api.get(`/events/${id}/seats`);
            setSeats(seatsRes.data.seats);
          } else if (state === "failed") {
            clearInterval(poll);
            setBookingStatus("error");
            setBookingMessage(
              failReason?.includes("MAX_6_SEATS")
                ? "❌ Maximum 6 seats allowed."
                : failReason?.includes("ALL_SEATS_LOCKED")
                  ? "❌ All selected seats are locked. Try again."
                  : "❌ Booking failed. Please try again.",
            );
            setBooking(false);
          }
        } catch {
          clearInterval(poll);
          setBooking(false);
        }
      }, 1000);

      setTimeout(() => clearInterval(poll), 15000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setBookingStatus("error");
      setBookingMessage(error.response?.data?.error || "Booking failed");
      setBooking(false);
    }
  };

  const getSeatColor = (seat: Seat) => {
    if (seat.status === "booked")
      return "bg-red-800 cursor-not-allowed opacity-60";
    if (seat.status === "locked")
      return "bg-yellow-700 cursor-not-allowed opacity-60";
    if (selectedSeats.find((s) => s.id === seat.id))
      return "bg-indigo-500 ring-2 ring-white scale-110";
    return "bg-gray-700 hover:bg-indigo-600 cursor-pointer";
  };

  const getDemandBar = () => {
    const pct = Math.round(demandScore * 100);
    const color =
      pct >= 70 ? "bg-red-500" : pct >= 40 ? "bg-yellow-500" : "bg-green-500";
    return { pct, color };
  };

  // Group seats by row
  const seatsByRow = seats.reduce(
    (acc, seat) => {
      if (!acc[seat.row_label]) acc[seat.row_label] = [];
      acc[seat.row_label].push(seat);
      return acc;
    },
    {} as Record<string, Seat[]>,
  );

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400 text-lg animate-pulse">
          Loading event...
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-red-400">Event not found.</div>
      </div>
    );
  }

  const { pct, color } = getDemandBar();
  const available = seats.filter((s) => s.status === "available").length;
  const booked = seats.filter((s) => s.status === "booked").length;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Back button */}
      <button
        onClick={() => navigate("/events")}
        className="text-gray-400 hover:text-white mb-6 flex items-center gap-2 transition"
      >
        ← Back to Events
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT — event info + seat map */}
        <div className="lg:col-span-2 space-y-6">
          {/* Event header */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <h1 className="text-3xl font-bold text-white mb-1">
              {event.title}
            </h1>
            <p className="text-gray-400 mb-1">📍 {event.venue}</p>
            <p className="text-gray-500 text-sm mb-4">
              📅 {formatDate(event.event_date)}
            </p>
            <p className="text-gray-400 text-sm">{event.description}</p>
          </div>

          {/* Seat map */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <h2 className="text-xl font-bold text-white mb-6">
              Select Your Seat
            </h2>

            {/* Stage */}
            <div className="bg-gray-700 rounded-xl py-3 text-center text-gray-400 text-sm font-medium mb-8 tracking-widest">
              — STAGE —
            </div>

            {/* Seat grid by row */}
            <div className="space-y-3">
              {Object.entries(seatsByRow).map(([row, rowSeats]) => (
                <div key={row} className="flex items-center gap-3">
                  <span className="text-gray-500 text-sm font-mono w-5 text-right">
                    {row}
                  </span>
                  <div className="flex gap-2 flex-wrap">
                    {rowSeats.map((seat) => (
                      <button
                        key={seat.id}
                        onClick={() => handleSeatClick(seat)}
                        disabled={seat.status !== "available"}
                        className={`w-10 h-10 rounded-lg text-xs font-semibold text-white transition-all duration-150 ${getSeatColor(seat)}`}
                        title={`${seat.seat_number} — ${seat.status}`}
                      >
                        {seat.seat_number.replace(row, "")}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex gap-6 mt-8 pt-4 border-t border-gray-800">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="w-4 h-4 rounded bg-gray-700"></div> Available
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="w-4 h-4 rounded bg-indigo-500"></div> Selected
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="w-4 h-4 rounded bg-red-800 opacity-60"></div>{" "}
                Booked
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — booking panel */}
        <div className="space-y-4">
          {/* Live price card */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Current Price</span>
              <span className="text-xs text-gray-500">Live 🔴</span>
            </div>
            <div className="text-4xl font-bold text-white mb-1">
              ₹{currentPrice.toLocaleString()}
            </div>
            {currentPrice > event.base_price && (
              <div className="text-sm text-gray-500 line-through">
                Base: ₹{event.base_price.toLocaleString()}
              </div>
            )}

            {/* Demand bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Demand</span>
                <span>{pct}%</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${color}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Seat stats */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <h3 className="text-white font-semibold mb-4">Availability</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-green-400">
                  {available}
                </div>
                <div className="text-xs text-gray-500 mt-1">Available</div>
              </div>
              <div className="bg-gray-800 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold text-red-400">{booked}</div>
                <div className="text-xs text-gray-500 mt-1">Booked</div>
              </div>
            </div>
          </div>

          {/* Booking panel */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <h3 className="text-white font-semibold mb-4">Your Selection</h3>

            {selectedSeats.length > 0 ? (
              <div className="space-y-4">
                <div className="bg-indigo-900/30 border border-indigo-700 rounded-xl p-4">
                  <div className="text-indigo-300 text-sm mb-2">
                    Selected Seats ({selectedSeats.length}/{MAX_SEATS})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedSeats.map((s) => (
                      <span
                        key={s.id}
                        onClick={() => handleSeatClick(s)}
                        className="bg-indigo-600 text-white text-sm font-bold px-3 py-1 rounded-lg cursor-pointer hover:bg-red-600 transition"
                        title="Click to deselect"
                      >
                        {s.seat_number}
                      </span>
                    ))}
                  </div>
                  <div className="text-indigo-400 text-xs mt-2">
                    Click a seat badge to deselect
                  </div>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Price per seat</span>
                  <span className="text-white">
                    ₹{currentPrice.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-gray-300">Total</span>
                  <span className="text-white text-lg">
                    ₹{(currentPrice * selectedSeats.length).toLocaleString()}
                  </span>
                </div>

                <button
                  onClick={handleBooking}
                  disabled={booking}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition"
                >
                  {booking
                    ? "Processing..."
                    : `Confirm ${selectedSeats.length} Seat(s)`}
                </button>
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500 text-sm">
                Click seats on the map to select up to {MAX_SEATS}
              </div>
            )}

            {/* Booking status message */}
            {bookingMessage && (
              <div
                className={`mt-4 p-3 rounded-xl text-sm text-center ${
                  bookingStatus === "success"
                    ? "bg-green-900/30 text-green-400 border border-green-800"
                    : bookingStatus === "error"
                      ? "bg-red-900/30 text-red-400 border border-red-800"
                      : "bg-blue-900/30 text-blue-400 border border-blue-800"
                }`}
              >
                {bookingMessage}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDetailPage;
