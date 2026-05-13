import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import type { EventType } from "../types";

const EventsPage = () => {
  const [events, setEvents] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await api.get("/events");
        setEvents(res.data.events);
      } catch (err) {
        console.error("Failed to fetch events:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDemandLabel = (score: number) => {
    if (score >= 0.7) return { label: "🔥 High Demand", color: "text-red-400" };
    if (score >= 0.4) return { label: "⚡ Medium Demand", color: "text-yellow-400" };
    return { label: "✅ Low Demand", color: "text-green-400" };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400 text-lg">Loading events...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Upcoming Events</h1>
        <p className="text-gray-400 mt-2">Book your seats before prices surge</p>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          No events available right now.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event: EventType) => {
            const demand = getDemandLabel(event.demand_score || 0);
            return (
              <div
                key={event.id}
                onClick={() => navigate(`/events/${event.id}`)}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-6 cursor-pointer hover:border-indigo-500 transition group"
              >
                <div className="flex items-start justify-between mb-4">
                  <span className="text-4xl">🎵</span>
                  <span className={`text-xs font-medium px-3 py-1 rounded-full bg-gray-800 ${demand.color}`}>
                    {demand.label}
                  </span>
                </div>

                <h2 className="text-xl font-bold text-white mb-1 group-hover:text-indigo-400 transition">
                  {event.title}
                </h2>
                <p className="text-gray-400 text-sm mb-4">{event.venue}</p>

                <div className="text-gray-500 text-sm mb-4">
                  📅 {formatDate(event.event_date)}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-800">
                  <div>
                    <div className="text-xs text-gray-500">Current Price</div>
                    <div className="text-xl font-bold text-white">
                      ₹{(event.current_price || event.base_price).toLocaleString()}
                    </div>
                    {event.current_price > event.base_price && (
                      <div className="text-xs text-gray-500 line-through">
                        ₹{event.base_price.toLocaleString()}
                      </div>
                    )}
                  </div>
                  <button className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg transition">
                    Book Now →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EventsPage;