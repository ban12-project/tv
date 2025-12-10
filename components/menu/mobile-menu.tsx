"use client";

import { Menu as MenuIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { CategoryNode } from "./index";

export function MobileMenu({ categories }: { categories: CategoryNode[] }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-white hover:bg-white/10"
        >
          <MenuIcon className="h-6 w-6" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 bg-zinc-950 border-zinc-800 p-2 max-h-[80vh] overflow-y-auto"
        align="end"
      >
        <div className="flex flex-col space-y-1">
          {categories.map((category) => (
            <div key={category.type_id} className="flex flex-col">
              <Link
                href={`/category/${category.type_id}`}
                className="px-3 py-2 hover:bg-white/10 rounded-md text-sm font-medium text-gray-200 hover:text-white transition-colors"
              >
                {category.type_name}
              </Link>
              {category.children && category.children.length > 0 && (
                <div className="ml-4 flex flex-col border-l border-zinc-800">
                  {category.children.map((child) => (
                    <Link
                      key={child.type_id}
                      href={`/category/${child.type_id}`}
                      className="px-3 py-1.5 hover:bg-white/10 rounded-r-md text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      {child.type_name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
