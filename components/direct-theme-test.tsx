"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export default function DirectThemeTest() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="p-20 space-y-4">
      <h1 className="text-4xl font-bold">Direct Theme Test</h1>
      <p>Current Theme: {theme}</p>
      <div className="flex gap-4">
        <Button id="set-light" onClick={() => setTheme("light")}>
          Set Light
        </Button>
        <Button id="set-dark" onClick={() => setTheme("dark")}>
          Set Dark
        </Button>
      </div>
      <div className="mt-8 p-10 border rounded-lg bg-card text-card-foreground">
        Card with background/foreground vars
      </div>
    </div>
  );
}
