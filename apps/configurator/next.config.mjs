import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packagesDir = path.resolve(__dirname, "../../packages");

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.BIRIM_AUDIT_BUILD === "1" ? ".next-v41" : ".next",
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    // Ensures ../../packages/* resolved via tsconfig paths are ALWAYS compiled by next-swc-loader
    // even if `npm install` was not re-run after adding @birim/integrations.
    externalDir: true,
  },
  transpilePackages: [
    "@birim/core",
    "@birim/geometry",
    "@birim/catalog",
    "@birim/pricing",
    "@birim/manufacturing",
    "@birim/integrations",
  ],
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@birim/core": path.join(packagesDir, "core/src/index.ts"),
      "@birim/geometry": path.join(packagesDir, "geometry/src/index.ts"),
      "@birim/catalog": path.join(packagesDir, "catalog/src/index.ts"),
      "@birim/pricing": path.join(packagesDir, "pricing/src/index.ts"),
      "@birim/manufacturing": path.join(packagesDir, "manufacturing/src/index.ts"),
      "@birim/integrations": path.join(packagesDir, "integrations/src/index.ts"),
    };
    return config;
  },
};

export default nextConfig;
