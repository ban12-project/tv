"use client";

import { Drawer } from "vaul";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useChatStore } from "@/lib/store/chat-store";
import { cn } from "@/lib/utils";
import { ChatInterface } from "./chat-interface";

export function ChatWidget({
  className,
  ...props
}: React.ComponentProps<"aside">) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const { isOpen, setOpen } = useChatStore();

  if (isDesktop) {
    return (
      <aside
        {...props}
        className={cn(
          "shrink-0 z-100 sticky h-screen top-0 right-0 border-l border-border transition-transformation ease-in-out transition-[width] duration-250 overflow-hidden bg-background",
          isOpen ? "w-100" : "w-0",
          className,
        )}
      >
        <ChatInterface isDesktop={isDesktop} />
      </aside>
    );
  }

  return (
    <Drawer.Root open={isOpen} onOpenChange={setOpen}>
      <Drawer.Portal>
        <Drawer.Content className="h-full flex flex-col fixed z-100 bottom-0 left-0 right-0 border-t border-border bg-background">
          <Drawer.Title className="sr-only">Chat Bot</Drawer.Title>
          <Drawer.Description className="sr-only">
            Ask AI for recommendations
          </Drawer.Description>

          <div className="flex-1 overflow-hidden h-full">
            <ChatInterface isDesktop={isDesktop} />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
