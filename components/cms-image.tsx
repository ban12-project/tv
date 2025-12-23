"use client";

import Image, { type ImageLoaderProps, type ImageProps } from "next/image";

/**
 * A custom loader that simply returns the original source URL.
 * This is used to bypass Next.js remotePatterns check for external images
 * that we don't want to optimize through Next.js server.
 */
const cmsLoader = ({ src }: ImageLoaderProps) => {
  return src;
};

interface CMSImageProps extends ImageProps {
  /**
   * If true, the image will always bypass Next.js optimization.
   * If false or omitted, it will only bypass if the src is an external URL.
   */
  forceExternal?: boolean;
}

export function CMSImage({ forceExternal, ...props }: CMSImageProps) {
  const srcString = typeof props.src === "string" ? props.src : "";
  const isExternal = forceExternal || srcString.startsWith("http");

  if (isExternal) {
    return <Image {...props} loader={cmsLoader} unoptimized />;
  }

  return <Image {...props} />;
}
