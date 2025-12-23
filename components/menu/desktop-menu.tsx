"use client";

import * as NavigationMenuPrimitive from "@radix-ui/react-navigation-menu";
import Link from "@/components/link";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import type { CategoryNode } from "./index";

export function DesktopMenu({ categories }: { categories: CategoryNode[] }) {
  return (
    <NavigationMenu
      className="hidden md:flex"
      viewport={false}
      data-viewport="true"
    >
      <NavigationMenuList>
        {categories.map((category) => (
          <NavigationMenuItem key={category.id}>
            {category.children && category.children.length > 0 ? (
              <>
                <NavigationMenuTrigger className="bg-transparent">
                  <Link href={`/category/${category.id}`}>{category.name}</Link>
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid gap-2 p-2 md:w-xs md:grid-cols-3 lg:w-sm">
                    {category.children.map((child) => (
                      <li key={child.id}>
                        <NavigationMenuLink
                          asChild
                          className={cn(
                            navigationMenuTriggerStyle(),
                            "bg-transparent hover:bg-white/10 active:scale-[0.98] rounded-xl transition-all",
                          )}
                        >
                          <Link href={`/category/${child.id}`}>
                            {child.name}
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
                <Link href={`/category/${category.id}`}>{category.name}</Link>
              </NavigationMenuLink>
            )}
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
      <div className="absolute left-0 top-full isolate z-50 flex justify-center">
        <NavigationMenuPrimitive.Viewport
          data-slot="navigation-menu-viewport"
          className="origin-top-center text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-90 relative mt-1.5 h-(--radix-navigation-menu-viewport-height) w-full overflow-hidden md:w-(--radix-navigation-menu-viewport-width) rounded-md bg-zinc-900/80 backdrop-blur-md border border-white/10 shadow-2xl"
        />
      </div>
    </NavigationMenu>
  );
}
