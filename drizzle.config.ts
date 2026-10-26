import { defineConfig } from "drizzle-kit";

// drizzle-kit does not load .env.local itself; the db:* scripts pass it via --env-file.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
