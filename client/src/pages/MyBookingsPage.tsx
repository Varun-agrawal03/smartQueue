import { useEffect, useState } from "react";
import api from "../api/axios";
import type { Booking } from "../types";

const MyBookingsPage = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const res = await api.get("/bookings/my");
        setBookings(res.data.bookings);
      } catch (err) {
        console.error("Failed to fetch bookings:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, []);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400 text-lg">Loading bookings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">My Bookings</h1>
        <p className="text-gray-400 mt-2">All your confirmed tickets</p>
      </div>

      {bookings.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          No bookings yet. Go book some tickets!
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex items-center justify-between"
            >
              <div className="flex items-center gap-6">
                <div className="bg-indigo-600 rounded-xl p-4 text-center min-w-[70px]">
                  <div className="text-2xl font-bold text-white">
                    {booking.seat_number}
                  </div>
                  <div className="text-indigo-200 text-xs">Seat</div>
                </div>

                <div>
                  <h3 className="text-white font-semibold text-lg">
                    {booking.event_title}
                  </h3>
                  <p className="text-gray-400 text-sm">{booking.venue}</p>
                  <p className="text-gray-500 text-xs mt-1">
                    📅 {formatDate(booking.event_date)}
                  </p>
                  <p className="text-gray-500 text-xs">
                    🕒 Booked on {formatDate(booking.booked_at)}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <div className="text-2xl font-bold text-white">
                  ₹{Number(booking.price_paid).toLocaleString()}
                </div>
                <span className="inline-block mt-2 text-xs px-3 py-1 rounded-full bg-green-900/40 text-green-400 border border-green-800">
                  ✓ {booking.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyBookingsPage;