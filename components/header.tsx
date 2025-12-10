import Link from "next/link";
import { Suspense, ViewTransition } from "react";
import { Menu } from "@/components/menu";
import { ScrollAwareHeader } from "@/components/scroll-aware-header";
import { SearchDialog } from "@/components/search-dialog";
import { Button } from "@/components/ui/button";
import { sourceProvider } from "@/lib/source-provider";

async function MenuLoader() {
  const categories = await sourceProvider.getCategories();
  return <Menu categories={categories} />;
}

export default function Header() {
  return (
    <ScrollAwareHeader>
      <header className="sticky top-0 w-full z-50 transition-colors duration-300 border-b border-transparent bg-transparent data-[scrolled=true]:bg-black/80 data-[scrolled=true]:backdrop-blur-md data-[scrolled=true]:border-white/10">
        <div className="px-6 md:px-8 lg:px-10">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Navigation */}
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center space-x-2">
                Home
              </Link>

              <ViewTransition>
                <Suspense
                  fallback={
                    <div className="hidden md:flex h-6 w-64 bg-white/5 rounded animate-pulse" />
                  }
                >
                  <MenuLoader />
                </Suspense>
              </ViewTransition>
            </div>

            {/* Search and Sign In */}
            <div className="flex items-center gap-4">
              <SearchDialog />
              <Button variant="secondary" size="sm" className="hidden sm:flex">
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </header>
    </ScrollAwareHeader>
  );
}
