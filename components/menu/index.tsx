"use client";

import type { Messages } from "@/get-dictionary";
import type { SelectRecommendation } from "@/lib/db/schema";
import { DesktopMenu } from "./desktop-menu";
import { MobileMenu } from "./mobile-menu";

export interface MenuNode {
  title: string;
  href?: string;
  description?: string;
  image?: string;
  children?: WithRequired<MenuNode, "href">[];
}

export function Menu({
  recommendations,
  dictionary,
  children,
}: {
  recommendations: SelectRecommendation[];
  dictionary: Messages;
  children?: React.ReactNode;
}) {
  const recommendationNodes = recommendations.map((rec) => {
    const href =
      rec.sourceId && rec.videoId
        ? `/watch/${rec.sourceId}/${rec.videoId}/${rec.epIndex || 1}`
        : `?q=${encodeURIComponent(rec.title)}`;

    return {
      title: rec.title,
      description: rec.description,
      image: rec.image,
      href,
    };
  }) satisfies MenuNode[];

  const customNodes: MenuNode[] = [
    {
      title: dictionary.header.recommended,
      children: recommendationNodes,
    },
    {
      title: dictionary.header["verify-cms"],
      href: "/verify-cms",
    },
  ];

  return (
    <>
      <DesktopMenu nodes={customNodes}>{children}</DesktopMenu>
      <MobileMenu nodes={customNodes}>{children}</MobileMenu>
    </>
  );
}
