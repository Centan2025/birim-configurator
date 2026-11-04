/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
