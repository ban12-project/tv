"use client";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useChatStore } from "@/lib/store/chat-store";
import { cn } from "@/lib/utils";
import { ChatInterface } from "./chat-interface";

export function ChatWidget() {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const { isOpen, setOpen } = useChatStore();

  if (isDesktop) {
    return (
      <aside
        className={cn(
          "fixed right-0 top-16 bottom-0 z-40 w-100 border-l border-border bg-background transition-transform duration-300 ease-in-out shadow-lg",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <ChatInterface />
      </aside>
    );
  }

  return (
    <Drawer open={isOpen} onOpenChange={setOpen}>
      <DrawerContent className="h-[95%] flex flex-col fixed bottom-0 left-0 right-0 border-t border-border">
        <DrawerHeader className="sr-only">
          <DrawerTitle>Chat Bot</DrawerTitle>
          <DrawerDescription>Ask AI for recommendations</DrawerDescription>
        </DrawerHeader>
        <div className="flex-1 overflow-hidden h-full">
          <ChatInterface />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
