"use client";

import { SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChatStore } from "@/lib/store/chat-store";

export function ChatToggle() {
  const { toggle, isOpen } = useChatStore();

  return (
    <Button
      variant={isOpen ? "secondary" : "ghost"}
      onClick={toggle}
      className="gap-2"
    >
      <SparklesIcon className="size-4" />
      <span className="hidden sm:inline">Ask AI</span>
    </Button>
  );
}
