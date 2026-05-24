import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "src/**/*.test.ts",
      "server/**/*.test.ts",
      "scripts/**/*.test.ts",
      "miniprogram/**/*.test.ts",
      "roadmap-viewer/**/*.test.ts"
    ],
    globals: false
  }
});
