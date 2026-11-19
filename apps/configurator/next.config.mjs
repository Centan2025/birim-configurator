import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packagesDir = path.resolve(__dirname, "../../packages");

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  distDir: process.env.BIRIM_AUDIT_BUILD === "1" ? ".next-v41" : ".next",
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: process.env.MODUL_ALLOW_TS_BUILD_ERRORS === "true",
  },
  experimental: {
    externalDir: true,
    optimizePackageImports: ["lucide-react"],
  },
  transpilePackages: [
    "@birim/core",
    "@birim/geometry",
    "@birim/catalog",
    "@birim/pricing",
    "@birim/manufacturing",
    "@birim/integrations",
  ],
  async headers() {
    return [
      {
        source: "/models/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/icon.svg",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/favicon.ico",
          destination: "/icon.svg",
        },
      ],
    };
  },
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@birim/core": path.join(packagesDir, "core/src/index.ts"),
      "@birim/geometry": path.join(packagesDir, "geometry/src/index.ts"),
      "@birim/catalog": path.join(packagesDir, "catalog/src/index.ts"),
      "@birim/pricing": path.join(packagesDir, "pricing/src/index.ts"),
      "@birim/manufacturing": path.join(packagesDir, "manufacturing/src/index.ts"),
      "@birim/integrations": path.join(packagesDir, "integrations/src/index.ts"),
      "@modul/core": path.join(packagesDir, "core/src/index.ts"),
      "@modul/geometry": path.join(packagesDir, "geometry/src/index.ts"),
      "@modul/catalog": path.join(packagesDir, "catalog/src/index.ts"),
      "@modul/pricing": path.join(packagesDir, "pricing/src/index.ts"),
      "@modul/manufacturing": path.join(packagesDir, "manufacturing/src/index.ts"),
      "@modul/integrations": path.join(packagesDir, "integrations/src/index.ts"),
    };
    return config;
  },
};

export default nextConfig;
