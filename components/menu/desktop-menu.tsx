"use client";

import * as NavigationMenuPrimitive from "@radix-ui/react-navigation-menu";
import React from "react";
import { CMSImage } from "@/components/cms-image";
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
          <NavigationMenuItem key={node.href || node.title}>
            {/* ... Existing node rendering ... */}
            {node.children && node.children.length > 0 ? (
              <>
                <NavigationMenuTrigger className="bg-transparent">
                  {node.href ? (
                    <Link href={node.href}>{node.title}</Link>
                  ) : (
                    node.title
                  )}
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid gap-3 p-4 w-87.5 md:w-150 lg:w-200 md:grid-cols-2 lg:grid-cols-3">
                    {node.children.map((child) => (
                      <li key={child.href} className="row-span-1">
                        <NavigationMenuLink
                          asChild
                          className={cn(
                            navigationMenuTriggerStyle(),
                            "bg-transparent hover:bg-muted/50 focus:bg-muted/50 active:scale-[0.98] rounded-xl transition-all h-full w-full justify-start p-3",
                          )}
                        >
                          <Link
                            href={child.href}
                            className="flex flex-row gap-3 h-full items-start"
                          >
                            {child.image && (
                              <div className="shrink-0 rounded-md overflow-hidden w-20 aspect-2/3 relative bg-muted">
                                <CMSImage
                                  src={child.image}
                                  alt={child.title}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                            )}
                            <div className="flex flex-col gap-1 min-w-0">
                              <span className="text-sm font-medium leading-none truncate w-full block">
                                {child.title}
                              </span>
                              {child.description && (
                                <p className="text-xs text-muted-foreground line-clamp-6">
                                  {child.description}
                                </p>
                              )}
                            </div>
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
                {node.href ? (
                  <Link href={node.href}>{node.title}</Link>
                ) : (
                  node.title
                )}
              </NavigationMenuLink>
            )}
          </NavigationMenuItem>
        ))}
        {React.Children.map(children, (child) => (
          <NavigationMenuItem key={child?.toString()}>
            {child}
          </NavigationMenuItem>
        ))}
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
