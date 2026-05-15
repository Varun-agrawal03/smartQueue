import { Worker, Job } from "bullmq";
import { createMultiBooking, BookingInput } from "../services/booking.service";
import { ENV } from "../config/env";

export const startBookingWorker = () => {
  const worker = new Worker(
    "booking-queue",
    async (job: Job<BookingInput>) => {
      console.log(`⚙️  Processing multi-booking job ${job.id}`);
      const result = await createMultiBooking(job.data);
      console.log(
        `✅ Booking group confirmed: ${result.groupId} — ${result.totalSeats} seat(s)`
      );
      return result;
    },
    {
      connection: {
        host: ENV.REDIS.host,
        port: ENV.REDIS.port,
      },
      concurrency: 5,
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