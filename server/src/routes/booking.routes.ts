import { Router, Response } from "express";
import { Queue } from "bullmq";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";
import { getUserBookings } from "../services/booking.service";
import { ENV } from "../config/env";

const router = Router();

// BullMQ queue instance
const bookingQueue = new Queue("booking-queue", {
  connection: {
    host: ENV.REDIS.host,
    port: ENV.REDIS.port,
  },
});

// POST /api/bookings  ← book a seat (protected)
router.post(
  "/",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { seatId, eventId } = req.body;
    const userId = req.userId;

    if (!seatId || !eventId) {
      res.status(400).json({ error: "seatId and eventId are required" });
      return;
    }

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      // Add job to queue instead of processing directly
      const job = await bookingQueue.add(
        "book-seat",
        { userId, seatId, eventId },
        {
          attempts: 3,         // retry up to 3 times on failure
          backoff: {
            type: "exponential",
            delay: 1000,       // wait 1s, 2s, 4s between retries
          },
        }
      );

      res.status(202).json({
        message: "Booking request queued",
        jobId: job.id,
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        res.status(500).json({ error: err.message });
      }
    }
  }
);

// GET /api/bookings/job/:jobId  ← check booking job status
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

      const state = await job.getState();
      const result = job.returnvalue;
      const failReason = job.failedReason;

      res.json({ jobId, state, result: result || null, failReason: failReason || null });
    } catch (err: unknown) {
      if (err instanceof Error) {
        res.status(500).json({ error: err.message });
      }
    }
  }
);

// GET /api/bookings/my  ← get my bookings (protected)
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

export default router;