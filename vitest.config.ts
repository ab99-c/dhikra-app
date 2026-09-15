import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": process.cwd(),
    },
  },
  test: {
    // Threads pool avoids child-process spawning (sandbox-friendly).
    pool: "threads",
  },
});
