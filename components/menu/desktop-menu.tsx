"use client";

import Link from "next/link";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { CategoryNode } from "./index";

export function DesktopMenu({ categories }: { categories: CategoryNode[] }) {
  const isMobile = useIsMobile();

  return (
    <NavigationMenu className="hidden md:flex" viewport={isMobile}>
      <NavigationMenuList>
        {categories.map((category) => (
          <NavigationMenuItem key={category.type_id}>
            {category.children && category.children.length > 0 ? (
              <>
                <NavigationMenuTrigger className="bg-transparent">
                  <Link href={`/category/${category.type_id}`}>
                    {category.type_name}
                  </Link>
                </NavigationMenuTrigger>
                <NavigationMenuContent className="rounded-2xl bg-zinc-900/80 backdrop-blur-md border border-white/10 shadow-2xl">
                  <ul className="grid gap-2 p-2 sm:w-20 md:w-40 md:grid-cols-2 lg:w-60">
                    {category.children.map((child) => (
                      <li key={child.type_id}>
                        <NavigationMenuLink
                          asChild
                          className={cn(
                            navigationMenuTriggerStyle(),
                            "bg-transparent hover:bg-white/10 active:scale-[0.98] rounded-xl transition-all",
                          )}
                        >
                          <Link href={`/category/${child.type_id}`}>
                            {child.type_name}
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </>
            ) : (
              <NavigationMenuLink
                className={cn(navigationMenuTriggerStyle(), "bg-transparent")}
                asChild
              >
                <Link href={`/category/${category.type_id}`}>
                  {category.type_name}
                </Link>
              </NavigationMenuLink>
            )}
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  );
}
