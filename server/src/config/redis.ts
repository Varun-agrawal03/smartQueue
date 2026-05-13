import Redis from "ioredis";
import { ENV } from "./env";

const redis = new Redis({
  host: ENV.REDIS.host,
  port: ENV.REDIS.port,
});

redis.on("connect", () => console.log("✅ Redis connected"));
redis.on("error", (err) => console.error("❌ Redis error:", err.message));

export default redis;