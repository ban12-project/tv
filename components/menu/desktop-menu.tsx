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
import type { MenuNode } from "./index";

export function DesktopMenu({
  nodes,
  children,
}: {
  nodes: MenuNode[];
  children?: React.ReactNode;
}) {
  return (
    <NavigationMenu
      className="hidden md:flex"
      viewport={false}
      data-viewport="true"
    >
      <NavigationMenuList>
        {nodes.map((node) => (
          <NavigationMenuItem key={node.href}>
            {/* ... Existing node rendering ... */}
            {node.children && node.children.length > 0 ? (
              <>
                <NavigationMenuTrigger className="bg-transparent">
                  <Link href={node.href}>{node.title}</Link>
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid gap-2 p-2 md:w-xs md:grid-cols-3 lg:w-sm">
                    {node.children.map((child) => (
                      <li key={child.href}>
                        <NavigationMenuLink
                          asChild
                          className={cn(
                            navigationMenuTriggerStyle(),
                            "bg-transparent hover:bg-white/10 active:scale-[0.98] rounded-xl transition-all",
                          )}
                        >
                          <Link href={child.href}>{child.title}</Link>
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
                <Link href={node.href}>{node.title}</Link>
              </NavigationMenuLink>
            )}
          </NavigationMenuItem>
        ))}
        {children && <NavigationMenuItem>{children}</NavigationMenuItem>}
      </NavigationMenuList>
      <div className="absolute left-0 top-full isolate z-50 flex justify-center">
        <NavigationMenuPrimitive.Viewport
          data-slot="navigation-menu-viewport"
          className="origin-top-center text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-90 relative mt-1.5 h-(--radix-navigation-menu-viewport-height) w-full overflow-hidden md:w-(--radix-navigation-menu-viewport-width) rounded-md bg-popover/80 backdrop-blur-md border border-border shadow-2xl transition-[width,height] duration-200"
        />
      </div>
    </NavigationMenu>
  );
}
