"use client";

import type { Messages } from "@/get-dictionary";
import type { Category } from "@/lib/adapters/types";
import { DesktopMenu } from "./desktop-menu";
import { MobileMenu } from "./mobile-menu";

export interface MenuNode {
  title: string;
  href: string;
  description?: string;
  children?: MenuNode[];
}

function buildMenuTree(categories: Category[]): MenuNode[] {
  const map = new Map<string | number, MenuNode>();
  const roots: MenuNode[] = [];

  // Initialize all nodes
  for (const cat of categories) {
    map.set(cat.id, {
      title: cat.name,
      href: `/category/${cat.id}`,
      children: [],
    });
  }

  // Build tree
  for (const cat of categories) {
    const node = map.get(cat.id)!;
    if (
      cat.parentId &&
      map.has(cat.parentId) &&
      cat.parentId !== 0 &&
      cat.parentId !== "0"
    ) {
      map.get(cat.parentId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export function Menu({
  categories,
  dictionary,
  children,
}: {
  categories: Category[];
  dictionary: Messages;
  children?: React.ReactNode;
}) {
  const menuTree = buildMenuTree(categories);

  const customNodes: MenuNode[] = [
    ...menuTree,
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
