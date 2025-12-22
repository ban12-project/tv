"use client";

import type { Category } from "@/lib/adapters/types";
import { DesktopMenu } from "./desktop-menu";
import { MobileMenu } from "./mobile-menu";

export interface CategoryNode extends Category {
  children?: CategoryNode[];
}

function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const map = new Map<string | number, CategoryNode>();
  const roots: CategoryNode[] = [];

  // Initialize all nodes
  for (const cat of categories) {
    map.set(cat.id, { ...cat, children: [] });
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

export function Menu({ categories }: { categories: Category[] }) {
  const categoryTree = buildCategoryTree(categories);

  return (
    <>
      <DesktopMenu categories={categoryTree} />
      <MobileMenu categories={categoryTree} />
    </>
  );
}
