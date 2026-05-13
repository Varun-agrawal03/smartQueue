import { Worker, Job } from "bullmq";
import { createBooking, BookingInput } from "../services/booking.service";
import { ENV } from "../config/env";

export const startBookingWorker = () => {
  const worker = new Worker(
    "booking-queue",
    async (job: Job<BookingInput>) => {
      console.log(`⚙️  Processing booking job ${job.id}`);
      const result = await createBooking(job.data);
      console.log(`✅ Booking confirmed: ${result.id}`);
      return result;
    },
    {
      connection: {
        host: ENV.REDIS.host,
        port: ENV.REDIS.port,
      },
      concurrency: 5, // process max 5 jobs at a time
    }
  );

  worker.on("completed", (job) => {
    console.log(`✅ Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`❌ Job ${job?.id} failed:`, err.message);
  });

  console.log("⚙️  Booking worker started");
  return worker;
};