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
      },
      {
        protocol: "https",
        hostname: "ps.ryzypics.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "img.jisuimage.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "pic.ry-pic.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "wangwangzyimg1.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "dbzy5.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "ry-pic.com",
        pathname: "/upload/vod/**",
      },
      {
        protocol: "https",
        hostname: "img.picbf.com",
        pathname: "/upload/vod/**",
      },
      {
        protocol: "https",
        hostname: "ok.zuidapic.com",
        pathname: "/upload/vod/**",
      },
      {
        protocol: "https",
        hostname: "imgwolong.com",
        pathname: "/upload/vod/**",
      },
      {
        protocol: "https",
        hostname: "wangwangzyimg.com",
        pathname: "/upload/vod/**",
      },
      {
        protocol: "https",
        hostname: "img.lzzyimg.com",
        pathname: "/upload/vod/**",
      },
      {
        protocol: "https",
        hostname: "imgwolong.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "tyyswimg.com",
        pathname: "/upload/vod/**",
      },
      {
        protocol: "https",
        hostname: "pic.youkupic.com",
        pathname: "/upload/vod/**",
      },
      {
        protocol: "https",
        hostname: "mtzy2.com",
        pathname: "/upload/vod/**",
      },
      {
        protocol: "https",
        hostname: "tu.moduzytupian.com",
        pathname: "/upload/vod/**",
      },
      {
        protocol: "https",
        hostname: "img.bfzypic.com",
        pathname: "/upload/vod/**",
      }
    ],
  },
};

export default nextConfig;
