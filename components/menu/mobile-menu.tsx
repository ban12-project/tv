"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
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
          className="md:hidden text-white hover:bg-white/10 group"
          aria-label="open menu"
        >
          <div className="flex flex-col justify-center items-center w-full h-full pointer-events-none before:bg-white before:w-5.5 before:h-[1.5px] before:transition-transform before:duration-150 before:block after:bg-white after:w-5.5 after:h-[1.5px] after:transition-transform after:duration-150 after:block group-data-[state=closed]:before:-translate-y-1 group-data-[state=closed]:before:rotate-0 group-data-[state=open]:before:translate-y-px group-data-[state=open]:before:rotate-45 group-data-[state=closed]:after:translate-y-1 group-data-[state=closed]:after:rotate-0 group-data-[state=open]:after:-translate-y-px group-data-[state=open]:after:-rotate-45"></div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popper-available-width) h-(--radix-popper-available-height) bg-zinc-900/95 backdrop-blur-2xl border-none p-6 shadow-none overflow-auto">
        <div className="flex flex-col space-y-6 w-full">
          {nodes.map((node) => (
            <div key={node.href} className="flex flex-col text-center">
              <PopoverPrimitive.Close asChild>
                <Link href={node.href}>
                  <h3 className="px-4 py-3 hover:bg-white/10 active:scale-[0.98] rounded-2xl text-2xl font-semibold text-white transition-transform">
                    {node.title}
                  </h3>
                </Link>
              </PopoverPrimitive.Close>

              {node.children && node.children.length > 0 && (
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {node.children.map((child) => (
                    <PopoverPrimitive.Close key={child.href} asChild>
                      <Link
                        href={child.href}
                        className="px-4 py-2 hover:bg-white/10 active:scale-[0.98] rounded-xl text-lg text-gray-400 hover:text-white transition-all bg-white/5"
                      >
                        {child.title}
                      </Link>
                    </PopoverPrimitive.Close>
                  ))}
                </div>
              )}
            </div>
          ))}
          {children && (
            <div className="flex flex-col items-center">{children}</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
