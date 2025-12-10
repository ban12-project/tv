"use client";

import { Slot } from "@radix-ui/react-slot";
import { useEffect, useRef, useState } from "react";

export function ScrollAwareHeader({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        // When the sentinel (top 20px) is NOT intersecting (scrolled past), then we are 'scrolled'.
        setScrolled(!entry.isIntersecting);
      },
      { root: null, threshold: 0 },
    );

    observerRef.current.observe(sentinel);

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  return (
    <>
      <div
        ref={sentinelRef}
        aria-hidden="true"
        className="absolute top-0 left-0 w-full h-5 pointer-events-none -z-50 bg-transparent"
      />
      <Slot data-scrolled={scrolled}>{children}</Slot>
    </>
  );
}
