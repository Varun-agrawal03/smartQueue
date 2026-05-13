import fs from "fs";
import path from "path";
import pool from "./index";

const runMigrations = async () => {
  const migrationsDir = path.join(__dirname, "migrations");

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // runs 001, 002, 003... in order

  console.log(`📦 Running ${files.length} migration(s)...`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, "utf-8");

    try {
      await pool.query(sql);
      console.log(`✅ Migrated: ${file}`);
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error(`❌ Failed: ${file} →`, err.message);
      }
      process.exit(1);
    }
  }

  console.log("🎉 All migrations complete!");
  process.exit(0);
};

runMigrations();