"use client";

import { Monitor, MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<React.ComponentRef<"div">>;

const themes = [
  { label: <SunMedium className="size-4" />, value: "light" },
  { label: <MoonStar className="size-4" />, value: "dark" },
  { label: <Monitor className="size-4" />, value: "system" },
];

export default function ColorSchemeToggle({ className }: Props) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className={cn(
        "flex rounded-full border border-solid border-input text-xs",
        className,
      )}
      role="radiogroup"
      tabIndex={0}
      aria-label="Select a color scheme preference"
    >
      {themes.map(({ label, value }) => (
        <label data-color-scheme-option={value} key={value}>
          <input
            className="peer sr-only"
            type="radio"
            value={value}
            autoComplete="off"
            checked={theme === value}
            onChange={() => setTheme(value)}
          />
          <div className="-m-px rounded-full p-1 text-center capitalize text-muted-foreground border border-transparent peer-checked:border-input peer-checked:text-foreground">
            {label}
          </div>
        </label>
      ))}
    </div>
  );
}
