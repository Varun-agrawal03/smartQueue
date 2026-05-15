import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import type { EventType } from "../types";
import { useAuth } from "../context/AuthContext";

const CATEGORY_CONFIG: Record<string, {
  label: string; emoji: string; gradient: string; tag: string;
}> = {
  concert:  { label: "Live Concerts",  emoji: "🎵", gradient: "from-purple-600 to-indigo-600", tag: "MUSIC"    },
  sports:   { label: "Sports Events",  emoji: "🏆", gradient: "from-green-600  to-teal-600",   tag: "SPORTS"   },
  movie:    { label: "Movies",         emoji: "🎬", gradient: "from-red-600    to-pink-600",   tag: "CINEMA"   },
  festival: { label: "Festivals",      emoji: "🎪", gradient: "from-orange-500 to-yellow-500", tag: "FESTIVAL" },
  comedy:   { label: "Comedy Shows",   emoji: "😂", gradient: "from-yellow-500 to-orange-500", tag: "COMEDY"   },
  theatre:  { label: "Theatre",        emoji: "🎭", gradient: "from-pink-600   to-rose-600",   tag: "THEATRE"  },
};

const CATEGORY_ORDER = ["concert","sports","movie","festival","comedy","theatre"];

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });

const getDemandBadge = (score: number) => {
  if (score >= 0.7) return { text: "🔥 Selling Fast", cls: "bg-red-900/60 text-red-300 border-red-700" };
  if (score >= 0.4) return { text: "⚡ High Demand",  cls: "bg-yellow-900/60 text-yellow-300 border-yellow-700" };
  return { text: "✅ Available", cls: "bg-green-900/60 text-green-300 border-green-700" };
};

interface EventCardProps {
  event: EventType;
  onBook: (id: string) => void;
}

const EventCard = ({ event, onBook }: EventCardProps) => {
  const cfg    = CATEGORY_CONFIG[event.category] || CATEGORY_CONFIG.concert;
  const demand = getDemandBadge(event.demand_score || 0);
  const price  = event.current_price || event.base_price;

  return (
    <div className="flex-shrink-0 w-72 bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-600 transition-all duration-300 hover:-translate-y-1 cursor-pointer group"
      onClick={() => onBook(event.id)}>

      {/* Card banner */}
      <div className={`bg-gradient-to-br ${cfg.gradient} h-36 flex flex-col items-center justify-center relative`}>
        <span className="text-5xl mb-1">{cfg.emoji}</span>
        <span className="text-white/80 text-xs font-semibold tracking-widest">{cfg.tag}</span>
        <div className="absolute top-3 right-3">
          <span className={`text-xs px-2 py-1 rounded-full border ${demand.cls}`}>
            {demand.text}
          </span>
        </div>
      </div>

      {/* Card content */}
      <div className="p-5">
        <h3 className="text-white font-bold text-base mb-1 line-clamp-1 group-hover:text-indigo-400 transition">
          {event.title}
        </h3>
        {event.artist_or_team && (
          <p className="text-indigo-400 text-xs mb-2">{event.artist_or_team}</p>
        )}
        <p className="text-gray-400 text-xs mb-1">📍 {event.venue}</p>
        <p className="text-gray-500 text-xs mb-4">📅 {formatDate(event.event_date)}</p>

        <div className="flex items-center justify-between pt-3 border-t border-gray-800">
          <div>
            <div className="text-xs text-gray-500">From</div>
            <div className="text-white font-bold text-lg">
              ₹{Number(price).toLocaleString()}
            </div>
          </div>
          <button className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition">
            Book Now →
          </button>
        </div>
      </div>
    </div>
  );
};

interface CategoryRowProps {
  category: string;
  events: EventType[];
  onBook: (id: string) => void;
}

const CategoryRow = ({ category, events, onBook }: CategoryRowProps) => {
  const cfg      = CATEGORY_CONFIG[category];
  const scrollRef = useRef<HTMLDivElement>(null);

  if (events.length === 0) return null;

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({
      left: dir === "right" ? 300 : -300,
      behavior: "smooth",
    });
  };

  return (
    <section className="mb-14">
      {/* Section header */}
      <div className="flex items-center justify-between mb-5 px-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{cfg.emoji}</span>
          <div>
            <h2 className="text-xl font-bold text-white">{cfg.label}</h2>
            <p className="text-gray-500 text-sm">{events.length} event{events.length > 1 ? "s" : ""} available</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => scroll("left")}
            className="w-9 h-9 rounded-full bg-gray-800 hover:bg-gray-700 text-white flex items-center justify-center transition text-sm"
          >←</button>
          <button
            onClick={() => scroll("right")}
            className="w-9 h-9 rounded-full bg-gray-800 hover:bg-gray-700 text-white flex items-center justify-center transition text-sm"
          >→</button>
        </div>
      </div>

      {/* Horizontal scroll row */}
      <div
        ref={scrollRef}
        className="flex gap-5 overflow-x-auto scrollbar-hide px-6 pb-2"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {events.map((event) => (
          <EventCard key={event.id} event={event} onBook={onBook} />
        ))}
      </div>

      {/* Divider */}
      <div className="mt-10 border-t border-gray-800/60 max-w-7xl mx-auto px-6" />
    </section>
  );
};

const LandingPage = () => {
  const [events, setEvents]   = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats]     = useState({ total: 0, cities: 0, categories: 0 });
  const navigate              = useNavigate();
  const { isAuthenticated }   = useAuth();

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await api.get("/events/landing");
        const data: EventType[] = res.data.events;
        setEvents(data);

        const cities = new Set(data.map((e) => e.venue.split(",").pop()?.trim())).size;
        const cats   = new Set(data.map((e) => e.category)).size;
        setStats({ total: data.length, cities, categories: cats });
      } catch (err) {
        console.error("Failed to fetch events:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const handleBook = (id: string) => {
    if (isAuthenticated) {
      navigate(`/events/${id}`);
    } else {
      navigate("/login");
    }
  };

  // Group events by category
  const grouped = CATEGORY_ORDER.reduce((acc, cat) => {
    acc[cat] = events.filter((e) => e.category === cat);
    return acc;
  }, {} as Record<string, EventType[]>);

  return (
    <div className="min-h-screen bg-gray-950">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/30 via-gray-950 to-purple-900/20 pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-900/40 border border-indigo-700/50 rounded-full px-4 py-2 text-indigo-300 text-sm mb-8">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse inline-block" />
            Live pricing — seats updating in real time
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight">
            Book Smarter,
            <span className="block bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Experience More
            </span>
          </h1>

          <p className="text-gray-400 text-xl mb-10 max-w-2xl mx-auto leading-relaxed">
            Concerts, sports, movies, festivals — all in one place.
            Real-time seat selection with live surge pricing.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button
              onClick={() => navigate(isAuthenticated ? "/events" : "/register")}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-4 rounded-xl text-lg transition-all hover:scale-105"
            >
              {isAuthenticated ? "Browse Events →" : "Get Started Free →"}
            </button>
            <button
              onClick={() => navigate("/login")}
              className="border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white font-semibold px-8 py-4 rounded-xl text-lg transition"
            >
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="border-y border-gray-800 bg-gray-900/50 py-8 mb-14">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-3xl font-black text-white">{stats.total}+</div>
            <div className="text-gray-400 text-sm mt-1">Live Events</div>
          </div>
          <div>
            <div className="text-3xl font-black text-white">{stats.categories}</div>
            <div className="text-gray-400 text-sm mt-1">Categories</div>
          </div>
          <div>
            <div className="text-3xl font-black text-white">{stats.cities}+</div>
            <div className="text-gray-400 text-sm mt-1">Cities</div>
          </div>
        </div>
      </section>

      {/* ── Event category rows ── */}
      {loading ? (
        <div className="text-center py-24 text-gray-400 text-lg animate-pulse">
          Loading events...
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-24 text-gray-500">
          No events available yet.
        </div>
      ) : (
        CATEGORY_ORDER.map((cat) =>
          grouped[cat].length > 0 ? (
            <CategoryRow
              key={cat}
              category={cat}
              events={grouped[cat]}
              onBook={handleBook}
            />
          ) : null
        )
      )}

      {/* ── How it works ── */}
      <section className="max-w-5xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold text-white mb-12">How SmartQueue Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { emoji: "🔍", title: "Browse Events",   desc: "Explore concerts, sports, movies and more. Real-time seat availability." },
            { emoji: "💺", title: "Pick Your Seats", desc: "Interactive seat map. Select up to 6 seats. Watch prices update live." },
            { emoji: "⚡", title: "Instant Booking", desc: "Queue-based booking prevents double booking. Confirmation in seconds." },
          ].map((step) => (
            <div key={step.title} className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
              <div className="text-4xl mb-4">{step.emoji}</div>
              <h3 className="text-white font-bold text-lg mb-2">{step.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section className="mx-6 mb-16 rounded-3xl bg-gradient-to-r from-indigo-600 to-purple-600 p-12 text-center max-w-5xl md:mx-auto">
        <h2 className="text-3xl font-black text-white mb-4">
          Ready to book your next experience?
        </h2>
        <p className="text-indigo-200 mb-8 text-lg">
          Join thousands of users booking smarter with real-time pricing.
        </p>
        <button
          onClick={() => navigate(isAuthenticated ? "/events" : "/register")}
          className="bg-white text-indigo-600 font-bold px-8 py-4 rounded-xl text-lg hover:bg-indigo-50 transition"
        >
          {isAuthenticated ? "Browse All Events →" : "Create Free Account →"}
        </button>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-800 py-10 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          {/* <span className="text-2xl">🎟️</span> */}
          <img src="/images/icon3.png" alt="smartqueue" className="w-8 h-8 object-contain " />
          <span className="text-white font-bold text-lg">SmartQueue</span>
        </div>
        <p className="text-gray-500 text-sm">
          Distributed Ticket Booking — Built with Node.js, Redis, Kafka, React
        </p>
      </footer>
    </div>
  );
};

export default LandingPage;