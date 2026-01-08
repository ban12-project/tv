"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import React from "react";
import Link from "@/components/link";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { MenuNode } from "./index";

export function MobileMenu({
  nodes,
  children,
}: {
  nodes: MenuNode[];
  children?: React.ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-foreground hover:bg-accent group"
          aria-label="open menu"
        >
          <div className="flex flex-col justify-center items-center w-full h-full pointer-events-none before:bg-current before:w-8.25 before:h-0.5 before:transition-transform before:duration-150 before:block before:scale-75 after:bg-current after:w-8.25 after:h-0.5 after:transition-transform after:duration-150 after:block after:scale-75 group-data-[state=closed]:before:-translate-y-1 group-data-[state=closed]:before:rotate-0 group-data-[state=open]:before:translate-y-px group-data-[state=open]:before:rotate-45 group-data-[state=closed]:after:translate-y-1 group-data-[state=closed]:after:rotate-0 group-data-[state=open]:after:-translate-y-px group-data-[state=open]:after:-rotate-45"></div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popper-available-width) h-(--radix-popper-available-height) bg-background/95 backdrop-blur-2xl border-none p-6 shadow-none overflow-auto">
        <div className="flex flex-col space-y-6 w-full">
          {nodes.map((node) => (
            <div
              key={node.href || node.title}
              className="flex flex-col text-center"
            >
              <PopoverPrimitive.Close asChild>
                {node.href ? (
                  <Link href={node.href}>
                    <h3 className="px-4 py-3 hover:bg-accent active:scale-[0.98] rounded-2xl text-2xl font-semibold text-foreground transition-transform">
                      {node.title}
                    </h3>
                  </Link>
                ) : (
                  <h3 className="px-4 py-3 text-2xl font-semibold text-foreground">
                    {node.title}
                  </h3>
                )}
              </PopoverPrimitive.Close>

              {node.children && node.children.length > 0 && (
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {node.children.map((child) => (
                    <PopoverPrimitive.Close
                      key={child.href || child.title}
                      asChild
                    >
                      {child.href ? (
                        <Link
                          href={child.href}
                          className="px-4 py-2 hover:bg-accent active:scale-[0.98] rounded-xl text-lg text-muted-foreground hover:text-foreground transition-all bg-secondary"
                        >
                          {child.title}
                        </Link>
                      ) : (
                        <span className="px-4 py-2 rounded-xl text-lg text-muted-foreground bg-secondary">
                          {child.title}
                        </span>
                      )}
                    </PopoverPrimitive.Close>
                  ))}
                </div>
              )}
            </div>
          ))}
          {React.Children.map(children, (child) => (
            <div className="flex flex-col items-center">{child}</div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
