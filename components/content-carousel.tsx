"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useRef } from "react";
import { Button } from "@/components/ui/button";

interface ContentItem {
  id: string;
  title: string;
  image: string;
  badge?: string;
  genre?: string;
  year?: string;
  description?: string;
}

interface ContentCarouselProps {
  title: string;
  items: ContentItem[];
  showNavigation?: boolean;
}

export default function ContentCarousel({
  title,
  items,
  showNavigation = true,
}: ContentCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 400;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <section className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold text-white">{title}</h2>
          {showNavigation && (
            <div className="flex space-x-2">
              <Button
                variant="secondary"
                size="icon"
                onClick={() => scroll("left")}
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                onClick={() => scroll("right")}
              >
                <ChevronRight className="w-6 h-6 text-white" />
              </Button>
            </div>
          )}
        </div>

        <div
          ref={scrollRef}
          className="flex space-x-6 overflow-x-auto scrollbar-hide scroll-smooth"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {items.map((item) => (
            <div key={item.id} className="flex-none w-80 group cursor-pointer">
              <div className="relative overflow-hidden rounded-lg mb-4 content-card-hover">
                <Image
                  src={item.image}
                  alt={item.title}
                  width={320}
                  height={192}
                  className="w-full h-48 object-cover"
                />
                {item.badge && (
                  <span className="absolute top-3 left-3 bg-orange-500 text-white px-2 py-1 rounded text-xs font-medium">
                    {item.badge}
                  </span>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                  <h3 className="text-white font-semibold text-lg mb-1">
                    {item.title}
                  </h3>
                  {item.genre && item.year && (
                    <p className="text-gray-300 text-sm">
                      {item.year} • {item.genre}
                    </p>
                  )}
                </div>
              </div>
              {item.description && (
                <p className="text-gray-400 text-sm overflow-hidden line-clamp-3">
                  {item.description}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
