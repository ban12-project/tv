"use client";

import type { MacCMSCategory } from "@/lib/adapters/mac-cms-adapter";
import { DesktopMenu } from "./desktop-menu";
import { MobileMenu } from "./mobile-menu";

export interface CategoryNode extends MacCMSCategory {
  children?: CategoryNode[];
}

function buildCategoryTree(categories: MacCMSCategory[]): CategoryNode[] {
  const map = new Map<number, CategoryNode>();
  const roots: CategoryNode[] = [];

  // Initialize all nodes
  categories.forEach((cat) => {
    map.set(cat.type_id, { ...cat, children: [] });
  });

  // Build tree
  categories.forEach((cat) => {
    const node = map.get(cat.type_id)!;
    if (cat.type_pid && map.has(cat.type_pid) && cat.type_pid !== 0) {
      map.get(cat.type_pid)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export function Menu({ categories }: { categories: MacCMSCategory[] }) {
  const categoryTree = buildCategoryTree(categories);

  return (
    <>
      <DesktopMenu categories={categoryTree} />
      <MobileMenu categories={categoryTree} />
    </>
  );
}
