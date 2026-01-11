"use client";

import * as React from "react";
import { CMSImage } from "@/components/cms-image";
import Link from "@/components/link";
import {
  NavigationMenuContent,
  NavigationMenuLink,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Messages } from "@/get-dictionary";
import type { DoubanItem } from "@/lib/actions/douban";
import { getDoubanTop250 } from "@/lib/actions/douban";
import { cn } from "@/lib/utils";

const RANGES = [
  { label: "1-50", start: 0, count: 50 },
  { label: "51-100", start: 50, count: 50 },
  { label: "101-150", start: 100, count: 50 },
  { label: "151-200", start: 150, count: 50 },
  { label: "201-250", start: 200, count: 50 },
];

export function DoubanMenu({
  initialItems,
  dictionary,
  variant = "desktop",
}: {
  initialItems: DoubanItem[];
  dictionary: Messages;
  variant?: "desktop" | "mobile";
}) {
  const [isPending, startTransition] = React.useTransition();
  const [activeTab, setActiveTab] = React.useState("1-50");
  const [data, setData] = React.useState<Record<string, DoubanItem[]>>({
    "1-50": initialItems,
  });

  const handleTabChange = (value: string) => {
    // If data already exists, update tab immediately without transition
    if (data[value]) {
      setActiveTab(value);
      return;
    }

    const range = RANGES.find((r) => r.label === value);
    if (!range) return;

    // Update tab immediately so skeletons can show in the new tab
    setActiveTab(value);

    startTransition(async () => {
      try {
        const result = await getDoubanTop250(range.start, range.count);
        setData((prev) => ({ ...prev, [value]: result }));
      } catch (error) {
        console.error(`Failed to fetch douban range ${value}:`, error);
      }
    });
  };

  const renderContent = () => (
    <Tabs value={activeTab} className="w-full" onValueChange={handleTabChange}>
      <div className="px-4 py-2 border-b border-border/50">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap bg-transparent gap-1 h-auto p-0">
          {RANGES.map((range) => (
            <TabsTrigger
              key={range.label}
              value={range.label}
              className="rounded-full px-4 py-1.5 data-[state=active]:bg-foreground data-[state=active]:text-background transition-all"
            >
              {range.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {RANGES.map((range) => (
        <TabsContent
          key={range.label}
          value={range.label}
          className="outline-none"
        >
          <ul className="grid gap-3 p-4 w-[calc(100vw-2rem)] md:w-150 lg:w-200 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-h-[60vh] overflow-y-auto custom-scrollbar min-h-75">
            {isPending || !data[range.label]
              ? Array.from({ length: 12 }).map((_, i) => (
                  <li
                    key={`skeleton-${range.label}-${i}`}
                    className="p-3 flex gap-3"
                  >
                    <Skeleton className="shrink-0 w-16 aspect-2/3 rounded-md" />
                    <div className="flex flex-col gap-2 flex-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  </li>
                ))
              : data[range.label]?.map((item) => {
                  const content = (
                    <Link
                      href={`?q=${encodeURIComponent(item.title)}`}
                      className="flex flex-row gap-3 h-full items-start"
                    >
                      <div className="shrink-0 rounded-md overflow-hidden w-16 aspect-2/3 relative bg-muted shadow-sm">
                        <CMSImage
                          src={item.cover_url}
                          alt={item.title}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="flex flex-col gap-1 min-w-0 text-left">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold leading-none truncate block">
                            {item.title}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 font-mono">
                            {item.rating.value}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-3">
                          {item.card_subtitle}
                        </p>
                        {item.description && (
                          <p className="text-[10px] text-muted-foreground/60 italic truncate">
                            "{item.description}"
                          </p>
                        )}
                      </div>
                    </Link>
                  );

                  return (
                    <li key={item.id} className="row-span-1">
                      {variant === "desktop" ? (
                        <NavigationMenuLink
                          asChild
                          className={cn(
                            navigationMenuTriggerStyle(),
                            "bg-transparent hover:bg-muted/50 focus:bg-muted/50 active:scale-[0.98] rounded-xl transition-all h-full w-full justify-start p-3 border border-transparent hover:border-border",
                          )}
                        >
                          {content}
                        </NavigationMenuLink>
                      ) : (
                        <div className="bg-transparent hover:bg-muted/50 focus:bg-muted/50 active:scale-[0.98] rounded-xl transition-all h-full w-full justify-start p-3 border border-transparent hover:border-border">
                          {content}
                        </div>
                      )}
                    </li>
                  );
                })}
          </ul>
        </TabsContent>
      ))}
    </Tabs>
  );

  if (variant === "mobile") {
    return (
      <div className="flex flex-col text-center w-full">
        <h3 className="px-4 py-3 text-2xl font-semibold text-foreground border-b border-border/50 mb-2">
          {dictionary.header["douban-top250"]}
        </h3>
        {renderContent()}
      </div>
    );
  }

  return (
    <>
      <NavigationMenuTrigger className="bg-transparent">
        {dictionary.header["douban-top250"]}
      </NavigationMenuTrigger>
      <NavigationMenuContent className="overflow-hidden rounded-2xl border-border/50 shadow-2xl">
        {renderContent()}
      </NavigationMenuContent>
    </>
  );
}
