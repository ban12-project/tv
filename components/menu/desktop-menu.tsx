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
                <NavigationMenuContent>
                  <ul className="grid gap-2 sm:w-20 md:w-40 md:grid-cols-2 lg:w-60">
                    {category.children.map((child) => (
                      <li key={child.type_id}>
                        <NavigationMenuLink
                          asChild
                          className={cn(
                            navigationMenuTriggerStyle(),
                            "bg-transparent",
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
