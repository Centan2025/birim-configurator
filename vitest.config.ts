import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
  resolve: {
    alias: {
      "@birim/core": path.resolve(__dirname, "./packages/core/src/index.ts"),
      "@birim/geometry": path.resolve(__dirname, "./packages/geometry/src/index.ts"),
      "@birim/catalog": path.resolve(__dirname, "./packages/catalog/src/index.ts"),
      "@birim/pricing": path.resolve(__dirname, "./packages/pricing/src/index.ts"),
      "@birim/manufacturing": path.resolve(__dirname, "./packages/manufacturing/src/index.ts"),
      "@birim/integrations": path.resolve(__dirname, "./packages/integrations/src/index.ts"),
    },
  },
});
