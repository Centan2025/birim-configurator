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
      // Prevents stale .next/cache/webpack 404s on main-app.js when extracting updated files on Windows
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
