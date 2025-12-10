"use client";

import Autoplay from "embla-carousel-autoplay";
import { Play, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import type { Video } from "@/lib/adapters/types";

interface HeroCarouselProps {
  videos: Video[];
}

export function HeroCarousel({ videos }: HeroCarouselProps) {
  const plugin = React.useRef(
    Autoplay({ delay: 6000, stopOnInteraction: true }),
  );

  return (
    <Carousel
      plugins={[plugin.current]}
      className="w-full relative overflow-hidden group"
      opts={{
        loop: true,
      }}
      onMouseEnter={plugin.current.stop}
      onMouseLeave={plugin.current.reset}
    >
      <CarouselContent className="h-[85vh]">
        {videos.map((video) => (
          <CarouselItem key={video.id} className="relative h-full w-full">
            {/* Background Image */}
            <div className="absolute inset-0 w-full h-full">
              <Image
                src={video.backgroundImage || video.image}
                alt={video.title}
                fill
                priority
                className="object-cover object-center"
              />
              {/* Gradient Overlay for Text Readability */}
              <div className="absolute inset-0 bg-linear-to-t from-black via-black/40 to-black/10" />
              <div className="absolute inset-0 bg-linear-to-r from-black/80 via-transparent to-transparent" />
            </div>

            {/* Content Overlay */}
            <div className="relative h-full flex items-end py-32 pl-12">
              <div className="max-w-2xl space-y-6">
                {/* Title Image or Text */}
                <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight drop-shadow-lg">
                  {video.title}
                </h1>

                <div className="flex items-center space-x-3 text-white/80 font-medium">
                  <span>{video.year}</span>
                  <span>•</span>
                  <span>{video.genre.join(", ")}</span>
                  {video.duration && (
                    <>
                      <span>•</span>
                      <span>{video.duration}</span>
                    </>
                  )}
                </div>

                <p className="text-lg text-white/90 line-clamp-3 font-medium leading-relaxed drop-shadow-md">
                  {video.description}
                </p>

                <div className="flex items-center gap-4 pt-2">
                  <Button
                    asChild
                    size="lg"
                    className="bg-white text-black hover:bg-neutral-200 font-bold rounded-full px-8 h-12"
                  >
                    <Link href={`/watch/${video.id}/1`}>
                      <Play className="mr-2 h-5 w-5 fill-black" /> Play Episode
                    </Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    className="bg-white/20 text-white hover:bg-white/30 backdrop-blur-md rounded-full px-8 h-12"
                  >
                    <Plus className="mr-2 h-5 w-5" /> Add to List
                  </Button>
                </div>
              </div>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      {/* Navigation Buttons (Hidden by default, show on hover) */}
      <div className="hidden group-hover:block transition-opacity duration-300">
        <CarouselPrevious className="left-4 bg-black/50 border-none text-white hover:bg-white/20 hover:text-white" />
        <CarouselNext className="right-4 bg-black/50 border-none text-white hover:bg-white/20 hover:text-white" />
      </div>
    </Carousel>
  );
}
