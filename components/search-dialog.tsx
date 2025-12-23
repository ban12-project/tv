"use client";

import IntlMessageFormat from "intl-messageformat";
import { Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { CMSImage } from "@/components/cms-image";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { DialogTitle } from "@/components/ui/dialog";
import type { Messages } from "@/get-dictionary";
import { useVideoSearch } from "@/hooks/use-video-search";
import type { Video } from "@/lib/adapters/types";
import { cn } from "@/lib/utils";
export function SearchDialog({
  dictionary,
  lang,
}: {
  dictionary: Messages;
  lang: string;
}) {
  const [open, setOpen] = React.useState(false);
  const {
    query,
    results,
    isPending,
    onQueryChange,
    onCompositionStart,
    onCompositionEnd,
  } = useVideoSearch(300);
  const router = useRouter();

  const handleQueryChange = (value: string) => {
    onQueryChange(value);
  };

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = (video: Video) => {
    setOpen(false);
    router.push(`/${lang}/watch/${video.sourceId}/${video.id}/1`);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="text-gray-300 hover:text-white"
        onClick={() => setOpen(true)}
      >
        <Search className="h-5 w-5" />
        <span className="sr-only">Search</span>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        shouldFilter={false}
        className={cn(
          "bg-neutral-900/80 border-white/5 **:data-[slot=command-input-wrapper]:border-white/5",
          !isPending &&
            !query &&
            results.length === 0 &&
            "**:data-[slot=command-input-wrapper]:border-transparent",
        )}
      >
        <DialogTitle className="hidden">Search</DialogTitle>

        <CommandInput
          placeholder={dictionary.header["search-placeholder"]}
          value={query}
          onValueChange={handleQueryChange}
          onCompositionStart={onCompositionStart}
          onCompositionEnd={onCompositionEnd}
          className="animate-caret-cycle"
        />

        <CommandList>
          {isPending && results.length === 0 && (
            <div className="py-6 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground animate-pulse">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>{dictionary.common.loading}</span>
            </div>
          )}

          {query && results.length === 0 && !isPending && (
            <CommandEmpty>
              {dictionary.header["search-no-results-found"].replace(
                "{query}",
                query,
              )}
            </CommandEmpty>
          )}

          {results.length > 0 && (
            <CommandGroup
              heading={new IntlMessageFormat(
                dictionary.header["search-results-count"],
                lang,
              ).format({ count: results.length })}
            >
              {results.map((item: Video) => (
                <CommandItem
                  key={item.uniqueKey}
                  value={`${item.sourceId}-${item.id}`}
                  onSelect={() => handleSelect(item)}
                >
                  {item.image && (
                    <div className="mr-2 h-8 w-14 relative rounded overflow-hidden shrink-0">
                      <CMSImage
                        src={item.image || "/placeholder.jpg"}
                        alt={item.title}
                        fill
                        sizes="56px"
                        className="object-cover rounded"
                      />
                    </div>
                  )}
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="truncate">{item.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.year} {item.type ? `• ${item.type}` : ""} •{" "}
                      {item.sourceName}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
