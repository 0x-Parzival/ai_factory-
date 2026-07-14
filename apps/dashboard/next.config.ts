import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 15's built-in lint runner does not understand this workspace's ESLint
  // 9 flat config. `pnpm --filter @ai-factory/dashboard lint` runs it directly.
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
