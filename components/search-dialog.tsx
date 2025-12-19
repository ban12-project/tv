"use client";

import type { DialogProps } from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useDebounceCallback } from "usehooks-ts";
import { getTrending, searchVideos } from "@/app/actions/content";
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
import type { Video } from "@/lib/adapters/types";

const initialState = {
  errors: null,
  results: [],
};

export function SearchDialog({ ...props }: DialogProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const router = useRouter();

  const [state, dispatch, isPending] = React.useActionState(
    searchVideos,
    initialState,
  );
  const formRef = React.useRef<HTMLFormElement>(null);

  const performSearch = useDebounceCallback(() => {
    formRef.current?.requestSubmit();
  }, 300);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (!value) {
      performSearch.cancel();
      return;
    }
    performSearch();
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

  const [trending, setTrending] = React.useState<Video[]>([]);

  React.useEffect(() => {
    getTrending().then(setTrending);
  }, []);

  const handleSelect = (id: string) => {
    setOpen(false);
    router.push(`/watch/${id}/1`);
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
        {...props}
      >
        <DialogTitle className="hidden">Search</DialogTitle>

        <form ref={formRef} action={dispatch} className="hidden">
          <input type="hidden" name="query" value={query} />
        </form>

        <CommandInput
          placeholder="Search movies and TV shows..."
          value={query}
          onValueChange={handleQueryChange}
        />

        <CommandList>
          {isPending && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          )}

          {query && state.results.length === 0 && !isPending && (
            <CommandEmpty>No results found.</CommandEmpty>
          )}

          {!query && trending.length > 0 && (
            <CommandGroup heading="Trending">
              {trending.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={() => handleSelect(item.id)}
                >
                  <Search className="mr-2 h-4 w-4" />
                  <span>{item.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {query && state.results.length > 0 && (
            <CommandGroup heading="Results">
              {state.results.map((item: Video) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={() => handleSelect(item.id)}
                >
                  {item.image && (
                    <div className="mr-2 h-8 w-14 relative rounded overflow-hidden shrink-0">
                      <Image
                        src={item.image || "/placeholder.jpg"}
                        alt={item.title}
                        fill
                        sizes="56px"
                        className="object-cover rounded"
                      />
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span>{item.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.year} {item.type ? `• ${item.type}` : ""}
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
