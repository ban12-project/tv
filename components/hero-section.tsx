"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Messages } from "@/get-dictionary";

export default function HeroSection({
  dictionary: dict,
}: {
  dictionary: Messages;
}) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const heroSlides = [
    {
      id: 1,
      title: dict["hero-section"].slide1.title,
      subtitle: dict["hero-section"].slide1.subtitle,
      pricing: dict["hero-section"].pricing,
      background: "https://ext.same-assets.com/3817037992/4186230272.webp",
    },
    {
      id: 2,
      title: dict["hero-section"].slide2.title,
      subtitle: dict["hero-section"].slide2.subtitle,
      pricing: dict["hero-section"].pricing,
      background: "https://ext.same-assets.com/3817037992/855966671.webp",
      badge: dict["hero-section"]["badge-new"],
      genres: [
        dict["hero-section"]["genre-tv-show"],
        dict["hero-section"]["genre-drama"],
        dict["hero-section"]["genre-action"],
      ],
    },
    {
      id: 3,
      title: dict["hero-section"].slide3.title,
      subtitle: dict["hero-section"].slide3.subtitle,
      pricing: dict["hero-section"].pricing,
      background: "https://ext.same-assets.com/3817037992/2755306390.webp",
      genres: [
        dict["hero-section"]["genre-tv-show"],
        dict["hero-section"]["genre-comedy"],
        dict["hero-section"]["genre-sports"],
      ],
    },
  ];

  const slide = heroSlides[currentSlide];

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
  }, [heroSlides.length]);

  const prevSlide = useCallback(() => {
    setCurrentSlide(
      (prev) => (prev - 1 + heroSlides.length) % heroSlides.length,
    );
  }, [heroSlides.length]);

  // Auto-rotation effect
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(nextSlide, 5000); // Change slide every 5 seconds
    return () => clearInterval(interval);
  }, [isPlaying, nextSlide]);

  // Pause auto-rotation on hover
  const handleMouseEnter = () => setIsPlaying(false);
  const handleMouseLeave = () => setIsPlaying(true);

  return (
    <section
      aria-label={dict["hero-section"]["aria-label-hero-section"]}
      className="relative h-screen flex items-center justify-center overflow-hidden"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Background Images with smooth transitions */}
      {heroSlides.map((slideItem, index) => (
        <div
          key={slideItem.id}
          className={`absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000 ${
            index === currentSlide ? "opacity-100" : "opacity-0"
          }`}
          style={{ backgroundImage: `url(${slideItem.background})` }}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute bottom-0 left-0 right-0 h-32 gradient-fade-up" />
        </div>
      ))}

      {/* Navigation Arrows */}
      <Button
        variant="secondary"
        size="icon"
        onClick={prevSlide}
        className="absolute left-8 top-1/2 transform -translate-y-1/2 z-20 "
      >
        <svg
          className="w-6 h-6 text-white group-hover:scale-110 transition-transform"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <title>{dict["hero-section"]["title-previous-slide"]}</title>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </Button>

      <Button
        variant="secondary"
        size="icon"
        onClick={nextSlide}
        className="absolute right-8 top-1/2 transform -translate-y-1/2 z-20"
      >
        <svg
          className="w-6 h-6 text-white group-hover:scale-110 transition-transform"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <title>{dict["hero-section"]["title-next-slide"]}</title>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </Button>

      {/* Content */}
      <div className="relative z-10 text-center max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {slide.badge && (
          <span className="inline-block bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-medium mb-4">
            {slide.badge}
          </span>
        )}

        {slide.genres && (
          <div className="flex justify-center items-center space-x-4 mb-4">
            {slide.genres.map((genre, index) => (
              <span key={genre} className="text-gray-300 text-sm">
                {genre}
                {index < slide.genres.length - 1 && (
                  <span className="ml-4">•</span>
                )}
              </span>
            ))}
          </div>
        )}

        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
          {slide.title}
        </h1>

        <p className="text-xl md:text-2xl text-gray-200 mb-4 max-w-2xl mx-auto leading-relaxed">
          {slide.subtitle}
        </p>

        <p className="text-gray-400 mb-8 text-lg">{slide.pricing}</p>

        <Button size="lg">
          {dict["hero-section"]["button-accept-free-trial"]}
        </Button>
      </div>

      {/* Navigation Dots with Auto-play Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center space-x-6">
        <div className="flex space-x-3">
          {heroSlides.map((slide, index) => (
            <Button
              key={slide.id}
              variant="ghost"
              size="icon"
              onClick={() => setCurrentSlide(index)}
              className={`relative w-3 h-3 rounded-full transition-all duration-200 ${
                index === currentSlide
                  ? "bg-white"
                  : "bg-white/30 hover:bg-white/50"
              }`}
            >
              {index === currentSlide && isPlaying && (
                <div className="absolute inset-0 rounded-full border-2 border-white animate-pulse" />
              )}
            </Button>
          ))}
        </div>

        {/* Auto-play Toggle */}
        <Button
          variant="secondary"
          size="icon"
          onClick={() => setIsPlaying(!isPlaying)}
          title={
            isPlaying
              ? dict["hero-section"]["title-pause-autoplay"]
              : dict["hero-section"]["title-resume-autoplay"]
          }
        >
          {isPlaying ? (
            <svg
              className="w-4 h-4 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <title>{dict["hero-section"]["title-pause"]}</title>
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg
              className="w-4 h-4 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <title>{dict["hero-section"]["title-play"]}</title>
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </Button>
      </div>
    </section>
  );
}
