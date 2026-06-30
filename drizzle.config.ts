import type { Config } from "drizzle-kit";

export default {
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  driver: "expo", // generates migrations bundled for expo-sqlite
} satisfies Config;
