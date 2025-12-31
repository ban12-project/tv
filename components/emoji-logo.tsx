"use client";

import * as React from "react";
import Link from "@/components/link";
import { cn } from "@/lib/utils";

// Unicode ranges for reliable emojis (Emoticons, Misc Symbols, Supplementals, etc.)
// Avoiding complex joined emojis for simplicity and reliability
const EMOJI_RANGES = [
  [0x1f600, 0x1f64f], // Emoticons
  [0x1f300, 0x1f5ff], // Misc Symbols & Pictographs
  [0x1f680, 0x1f6ff], // Transport & Map
  [0x1f900, 0x1f9ff], // Supplemental Symbols & Pictographs
];

function getRandomEmoji() {
  const range = EMOJI_RANGES[Math.floor(Math.random() * EMOJI_RANGES.length)];
  const codePoint =
    Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
  return String.fromCodePoint(codePoint);
}

function AnimateChange({
  children,
  prev,
  className,
}: {
  children: React.ReactNode;
  prev: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative grid place-items-center", className)}>
      <style>{`
        @keyframes emojiFadeIn {
          0% {
            opacity: 0;
            filter: blur(2px);
            transform: translateY(8px);
          }
          100% {
            opacity: 1;
            filter: blur(0px);
            transform: translateY(0);
          }
        }
        @keyframes emojiFadeOut {
          0% {
            opacity: 1;
            filter: blur(0px);
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateY(-12px);
            filter: blur(2px);
          }
        }
        .animate-emoji-enter {
          animation: emojiFadeIn 300ms cubic-bezier(0.23, 0.88, 0.26, 0.92) forwards;
        }
        .animate-emoji-exit {
          animation: emojiFadeOut 300ms cubic-bezier(0.23, 0.88, 0.26, 0.92) forwards;
        }
      `}</style>

      {/* Current Value (Entering) */}
      <div key={String(children)} className="animate-emoji-enter">
        {children}
      </div>

      {/* Previous Value (Exiting) */}
      <div
        key={`${String(prev)}-prev`}
        aria-hidden="true"
        className="animate-emoji-exit absolute"
      >
        {prev}
      </div>
    </div>
  );
}

export function EmojiLogo() {
  const [currentEmoji, setCurrentEmoji] = React.useState("📺");
  const [prevEmoji, setPrevEmoji] = React.useState("📺");

  // Initialize with a random emoji on mount (hydration safe)
  React.useEffect(() => {
    setCurrentEmoji(getRandomEmoji());
  }, []);

  const handleMouseEnter = () => {
    // Immediate change on hover start
    setPrevEmoji(currentEmoji);
    let nextEmoji = getRandomEmoji();
    while (nextEmoji === currentEmoji) {
      nextEmoji = getRandomEmoji();
    }
    setCurrentEmoji(nextEmoji);
  };

  return (
    <Link
      href="/"
      className="flex items-center justify-center rounded-md hover:bg-accent transition-colors interact-button group"
      onMouseEnter={handleMouseEnter}
    >
      <AnimateChange
        className="w-8 h-8 text-2xl leading-none select-none"
        prev={prevEmoji}
      >
        {currentEmoji}
      </AnimateChange>
    </Link>
  );
}
