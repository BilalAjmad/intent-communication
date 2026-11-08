import { defineConfig } from "vite";

export default defineConfig({
  root: "src",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    lib: {
      entry: "main.ts",
      name: "IntentStudio",
      formats: ["es", "umd"],
      fileName: (format) => `studio.${format}.js`,
    },
    rollupOptions: {
      external: ["@intent/schema", "@intent/core", "@intent/engine"],
      output: {
        globals: {
          "@intent/schema": "IntentSchema",
          "@intent/core": "IntentCore",
          "@intent/engine": "IntentEngine",
        },
      },
    },
  },
  server: {
    port: 3457,
    proxy: {
      "/events": "http://localhost:3456",
      "/mcp": "http://localhost:3456",
      "/health": "http://localhost:3456",
    },
  },
});