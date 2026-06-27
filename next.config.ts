import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  cacheComponents: true,
  experimental: {
    viewTransition: true,
  },
  logging: {
    browserToTerminal: true,
  },
};

export default nextConfig;
