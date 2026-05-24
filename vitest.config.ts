import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "apps/legacy-capacitor/src/**/*.test.ts",
      "apps/miniprogram/**/*.test.ts",
      "services/**/*.test.ts",
      "tools/scripts/**/*.test.ts",
      "tools/roadmap-viewer/**/*.test.ts"
    ],
    globals: false
  }
});
