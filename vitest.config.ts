import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    projects: [
      {
        plugins: [react()],
        resolve: {
          alias: {
            "@": path.resolve(import.meta.dirname, "src"),
          },
        },
        test: {
          environment: "node",
          include: ["src/**/*.spec.ts"],
          name: "node",
        },
      },
      {
        plugins: [react()],
        resolve: {
          alias: {
            "@": path.resolve(import.meta.dirname, "src"),
          },
        },
        test: {
          environment: "jsdom",
          globals: true,
          include: ["src/**/*.spec.tsx"],
          name: "jsdom",
          setupFiles: ["./src/test/setup.ts"],
        },
      },
    ],
  },
});
