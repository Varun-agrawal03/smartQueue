import { Pool } from "pg";
import { ENV } from "../config/env";

const pool = new Pool({
  host: ENV.DB.host,
  port: ENV.DB.port,
  user: ENV.DB.user,
  password: ENV.DB.password,
  database: ENV.DB.database,
});

pool.on("connect", () => {
  console.log("✅ PostgreSQL connected");
});

pool.on("error", (err) => {
  console.error("❌ PostgreSQL error:", err.message);
});

export const query = (text: string, params?: unknown[]) =>
  pool.query(text, params);

export default pool;