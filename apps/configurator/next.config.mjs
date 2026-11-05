/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.BIRIM_AUDIT_BUILD === "1" ? ".next-v41" : ".next",
  transpilePackages: [
    "@birim/core",
    "@birim/geometry",
    "@birim/catalog",
    "@birim/pricing",
    "@birim/manufacturing",
    "@birim/integrations",
  ],
};

export default nextConfig;
