import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.E2E_BUILD === "1" ? undefined : "standalone",
  distDir: process.env.E2E_BUILD === "1" ? ".next-e2e" : ".next",
  reactCompiler: true,
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    instantInsights: {
      validationLevel: "warning",
    },
    exposeTestingApiInProductionBuild: process.env.E2E_BUILD === "1",
    turbopackFileSystemCacheForBuild: true,
    turbopackRustReactCompiler: true,
  },
  logging: {
    browserToTerminal: true,
  },
};

export default nextConfig;
