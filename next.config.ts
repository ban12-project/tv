import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    instantInsights: {
      validationLevel: "warning",
    },
  },
  logging: {
    browserToTerminal: true,
  },
};

export default nextConfig;
