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
import type { SelectRecommendation } from "@/lib/db/schema";
import { useLocale } from "./i18n";

export function SearchDialog({
  dictionary,
  recommendations,
}: {
  dictionary: Messages;
  recommendations: SelectRecommendation[];
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
  const { locale } = useLocale();

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

  const handleSelect = (item: Video | SelectRecommendation) => {
    setOpen(false);
    router.push(`/${locale}/watch/${item.sourceId}/${item.id}/1`);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
      >
        <Search className="h-5 w-5" />
        <span className="sr-only">Search</span>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        shouldFilter={false}
        className="bg-popover border-border **:data-[slot=command-input-wrapper]:border-border"
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

          {!query && recommendations.length > 0 && (
            <CommandGroup heading={dictionary.header.recommended}>
              {recommendations.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={() => handleSelect(item)}
                >
                  {item.image && (
                    <div className="w-14 aspect-2/3 relative rounded overflow-hidden shrink-0">
                      <CMSImage
                        src={item.image || "/placeholder.jpg"}
                        alt={item.title}
                        fill
                        sizes="56px"
                        className="object-cover rounded"
                      />
                    </div>
                  )}
                  <div className="flex flex-col flex-1 min-w-0 gap-2">
                    <span className="truncate">{item.title}</span>
                    <span className="text-xs text-muted-foreground line-clamp-2">
                      {item.description}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results.length > 0 && (
            <CommandGroup
              heading={new IntlMessageFormat(
                dictionary.header["search-results-count"],
                locale,
              ).format({ count: results.length })}
            >
              {results.map((item: Video) => (
                <CommandItem
                  key={item.uniqueKey}
                  value={`${item.sourceId}-${item.id}`}
                  onSelect={() => handleSelect(item)}
                >
                  {item.image && (
                    <div className="w-14 aspect-2/3 relative rounded overflow-hidden shrink-0">
                      <CMSImage
                        src={item.image || "/placeholder.jpg"}
                        alt={item.title}
                        fill
                        sizes="56px"
                        className="object-cover rounded"
                      />
                    </div>
                  )}
                  <div className="flex flex-col flex-1 min-w-0 gap-2">
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
