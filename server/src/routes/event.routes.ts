import { Router, Request, Response } from "express";
import {
  createEvent, getAllEvents, getEventById,
  getEventSeats, getEventsByCategory, getLandingPageEvents,
} from "../services/event.service";
import { authMiddleware } from "../middleware/auth.middleware";
import redis from "../config/redis";

const router = Router();

// GET /api/events/landing  ← public, no auth
router.get("/landing", async (_req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = "landing:events";
    const cached   = await redis.get(cacheKey);

    if (cached) {
      res.json({ events: JSON.parse(cached), source: "cache" });
      return;
    }

    const events = await getLandingPageEvents();
    await redis.setex(cacheKey, 30, JSON.stringify(events));
    res.json({ events, source: "db" });
  } catch (err: unknown) {
    if (err instanceof Error) res.status(500).json({ error: err.message });
  }
});

// GET /api/events/category/:category  ← public
router.get(
  "/category/:category",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const category = req.params.category as string;
      const events   = await getEventsByCategory(category);
      res.json({ events });
    } catch (err: unknown) {
      if (err instanceof Error) res.status(500).json({ error: err.message });
    }
  }
);

// POST /api/events  ← create event (protected)
router.post(
  "/",
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    const {
      title, venue, description, event_date,
      total_seats, base_price, rows, seats_per_row,
      category, thumbnail_url, artist_or_team,
    } = req.body;

    if (!title || !venue || !event_date || !total_seats ||
        !base_price || !rows || !seats_per_row) {
      res.status(400).json({ error: "All fields are required" });
      return;
    }

    try {
      const event = await createEvent({
        title, venue, description, event_date,
        total_seats, base_price, rows, seats_per_row,
        category, thumbnail_url, artist_or_team,
      });
      res.status(201).json({ message: "Event created", event });
    } catch (err: unknown) {
      if (err instanceof Error) res.status(400).json({ error: err.message });
    }
  }
);

// GET /api/events  ← list all events (public)
router.get("/", async (_req: Request, res: Response): Promise<void> => {
  try {
    const events = await getAllEvents();
    res.json({ events });
  } catch (err: unknown) {
    if (err instanceof Error) res.status(500).json({ error: err.message });
  }
});

// GET /api/events/:id  ← single event (public)
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const eventId     = req.params.id as string;
    const event       = await getEventById(eventId);
    const cachedPrice = await redis.get(`price:event:${eventId}`);
    const currentPrice = cachedPrice
      ? parseFloat(cachedPrice)
      : event.base_price;
    const demandScore = await redis.get(`demand:event:${eventId}`);

    res.json({
      event: {
        ...event,
        current_price: currentPrice,
        demand_score:  demandScore ? parseFloat(demandScore) : 0,
      },
    });
  } catch (err: unknown) {
    if (err instanceof Error) res.status(404).json({ error: err.message });
  }
});

// GET /api/events/:id/seats  ← get seats (public)
router.get("/:id/seats", async (req: Request, res: Response): Promise<void> => {
  try {
    const seatEventId = req.params.id as string;
    const cacheKey    = `seats:event:${seatEventId}`;
    const cached      = await redis.get(cacheKey);

    if (cached) {
      res.json({ seats: JSON.parse(cached), source: "cache" });
      return;
    }

    const seats = await getEventSeats(seatEventId);
    await redis.setex(cacheKey, 60, JSON.stringify(seats));
    res.json({ seats, source: "db" });
  } catch (err: unknown) {
    if (err instanceof Error) res.status(500).json({ error: err.message });
  }
});

export default router;