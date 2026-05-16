"use client";

import { SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Messages } from "@/get-dictionary";
import { useChatStore } from "@/lib/store/chat-store";

export function ChatToggle({ dictionary }: { dictionary: Messages["chat"] }) {
  const { toggle } = useChatStore();

  return (
    <Button variant="ghost" onClick={toggle} className="gap-2">
      <SparklesIcon className="size-4" />
      <span className="hidden sm:inline">{dictionary.toggle}</span>
    </Button>
  );
}
