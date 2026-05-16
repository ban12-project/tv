"use client";

import type { Messages } from "@/get-dictionary";
import type { DoubanItem } from "@/lib/actions/douban";
import type { SelectRecommendation } from "@/lib/db/schema";
import { DesktopMenu } from "./desktop-menu";
import { DoubanMenu } from "./douban-menu";
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
  doubanItems,
  dictionary,
  children,
  doubanEnabled,
  cmsAdminEnabled,
}: {
  recommendations: SelectRecommendation[];
  doubanItems: DoubanItem[];
  dictionary: Messages;
  children?: React.ReactNode;
  doubanEnabled: boolean;
  cmsAdminEnabled: boolean;
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
    ...(cmsAdminEnabled
      ? [
          {
            title: dictionary.header["verify-cms"],
            href: "/verify-cms",
          },
        ]
      : []),
  ];

  return (
    <>
      <DesktopMenu nodes={customNodes}>
        {doubanEnabled ? (
          <DoubanMenu
            initialItems={doubanItems}
            dictionary={dictionary}
            variant="desktop"
          />
        ) : null}
        {children}
      </DesktopMenu>
      <MobileMenu
        nodes={customNodes}
        openLabel={dictionary.common["open-menu"]}
      >
        {doubanEnabled ? (
          <DoubanMenu
            initialItems={doubanItems}
            dictionary={dictionary}
            variant="mobile"
          />
        ) : null}
        {children}
      </MobileMenu>
    </>
  );
}
