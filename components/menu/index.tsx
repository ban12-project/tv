"use client";

import type { Messages } from "@/get-dictionary";
import type { SelectRecommendation } from "@/lib/db/schema";
import { useLocale } from "../i18n";
import { DesktopMenu } from "./desktop-menu";
import { MobileMenu } from "./mobile-menu";

export interface MenuNode {
  title: string;
  href: string;
  description?: string;
  image?: string;
  children?: MenuNode[];
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
  const { locale } = useLocale();

  const recommendationNodes: MenuNode[] = recommendations.map((rec) => {
    const href =
      rec.sourceId && rec.videoId
        ? `/${locale}/watch/${rec.sourceId}/${rec.videoId}/${rec.epIndex || 1}`
        : `/${locale}?q=${encodeURIComponent(rec.title)}`;

    return {
      title: rec.title,
      description: rec.description,
      image: rec.image,
      href,
    };
  });

  const customNodes: MenuNode[] = [
    {
      title: dictionary.header.recommended,
      href: "#",
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
