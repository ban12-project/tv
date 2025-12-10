"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SearchDialog } from "@/components/search-dialog";
import { Button } from "@/components/ui/button";
import type { Messages } from "@/get-dictionary";
import { cn } from "@/lib/utils";

export default function Header({
  dictionary: _dict,
}: {
  dictionary: Messages;
}) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 w-full z-50 transition-colors duration-300 border-b border-transparent",
        scrolled
          ? "bg-black/80 backdrop-blur-md border-white/10"
          : "bg-transparent",
      )}
    >
      <div className="px-6 md:px-8 lg:px-10">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Navigation */}
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-white text-xl font-bold tracking-tighter">
                Ban12<span className="font-normal text-gray-400 ml-1">TV</span>
              </span>
            </Link>

            <nav className="hidden md:flex items-center space-x-6">
              <Link
                href="/"
                className={cn(
                  "text-sm font-medium transition-colors hover:text-white",
                  pathname === "/" ? "text-white" : "text-gray-400",
                )}
              >
                Home
              </Link>
              <Link
                href="/movies"
                className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
              >
                Movies
              </Link>
              <Link
                href="/shows"
                className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
              >
                TV Shows
              </Link>
            </nav>
          </div>

          {/* Search and Sign In */}
          <div className="flex items-center space-x-4">
            <SearchDialog />

            <Button variant="secondary" size="sm" className="hidden sm:flex">
              Sign In
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
