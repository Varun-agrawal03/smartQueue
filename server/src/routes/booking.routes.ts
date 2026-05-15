import { Router, Response } from "express";
import { Queue } from "bullmq";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";
import { getUserBookings, getUserBookingGroups } from "../services/booking.service";
import { ENV } from "../config/env";

const router = Router();

const bookingQueue = new Queue("booking-queue", {
  connection: {
    host: ENV.REDIS.host,
    port: ENV.REDIS.port,
  },
});

// POST /api/bookings — multi-seat booking
router.post(
  "/",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { seatIds, eventId } = req.body;
    const userId = req.userId;

    if (!seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
      res.status(400).json({ error: "seatIds array is required" });
      return;
    }

    if (seatIds.length > 6) {
      res.status(400).json({ error: "Maximum 6 seats per booking" });
      return;
    }

    if (!eventId) {
      res.status(400).json({ error: "eventId is required" });
      return;
    }

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const job = await bookingQueue.add(
        "book-seats",
        { userId, seatIds, eventId },
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 1000 },
        }
      );

      res.status(202).json({
        message: "Booking request queued",
        jobId: job.id,
        seatsRequested: seatIds.length,
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        res.status(500).json({ error: err.message });
      }
    }
  }
);

// GET /api/bookings/job/:jobId
router.get(
  "/job/:jobId",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const jobId = req.params.jobId as string;
      const job = await bookingQueue.getJob(jobId);

      if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
      }

      const state      = await job.getState();
      const result     = job.returnvalue;
      const failReason = job.failedReason;

      res.json({ jobId, state, result: result || null, failReason: failReason || null });
    } catch (err: unknown) {
      if (err instanceof Error) {
        res.status(500).json({ error: err.message });
      }
    }
  }
);

// GET /api/bookings/my — individual bookings
router.get(
  "/my",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const bookings = await getUserBookings(req.userId!);
      res.json({ bookings });
    } catch (err: unknown) {
      if (err instanceof Error) {
        res.status(500).json({ error: err.message });
      }
    }
  }
);

// GET /api/bookings/my/groups — grouped bookings
router.get(
  "/my/groups",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const groups = await getUserBookingGroups(req.userId!);
      res.json({ groups });
    } catch (err: unknown) {
      if (err instanceof Error) {
        res.status(500).json({ error: err.message });
      }
    }
  }
);

export default router;