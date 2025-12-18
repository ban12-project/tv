import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  cacheComponents: true,
  experimental: {
    viewTransition: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "vip.dytt-img.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "img1.doubanio.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "img.ffzy888.com",
        pathname: "/**",
      }
    ],
  },
};

export default nextConfig;
