import path from "node:path";
import { defineConfig } from "vitest/config";

// Integration tests run the server modules against a separate database (never the dev one):
//   docker exec jerrycomputer-postgres-1 psql -U jerry -d postgres -c "create database jerry_computers_test"
//   npm run test:db:migrate && npm test
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://jerry:jerry@localhost:5433/jerry_computers_test";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/stubs/empty.ts"),
      "next/cache": path.resolve(__dirname, "tests/stubs/next-cache.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    // One shared database: run files one at a time.
    fileParallelism: false,
    testTimeout: 30_000,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      AUTH_SECRET: "test-secret-test-secret-test-secret-123",
      SMTP_HOST: "localhost",
      SMTP_PORT: "1025",
      MAIL_FROM: "test@example.com",
    },
    setupFiles: ["tests/setup.ts"],
  },
});
