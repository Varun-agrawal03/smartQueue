import redis from "../config/redis";

const LOCK_TTL_MS = 10000; // 10 seconds

export const acquireLock = async (seatId: string): Promise<boolean> => {
  const lockKey = `lock:seat:${seatId}`;

  // ioredis v5+ syntax for SET NX PX
  const result = await redis.set(lockKey, "locked", "EX", 10, "NX");

  // returns "OK" if lock acquired, null if already locked
  return result === "OK";
};

export const releaseLock = async (seatId: string): Promise<void> => {
  const lockKey = `lock:seat:${seatId}`;
  await redis.del(lockKey);
};