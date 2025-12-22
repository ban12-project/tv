import { ShieldCheck } from "lucide-react";
import type { Messages } from "@/get-dictionary";

export default function Bailiff({
  messages,
}: {
  messages: Messages["protected"]["bailiff"];
}) {
  return (
    <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-700">
      <div className="relative group">
        {/* Animated glow effect */}
        <div className="absolute -inset-4 bg-primary/20 blur-2xl rounded-full group-hover:bg-primary/30 transition-all duration-500 animate-pulse" />

        {/* Icon container */}
        <div className="relative flex items-center justify-center w-24 h-24 rounded-full bg-background border border-primary/20 shadow-2xl backdrop-blur-sm">
          <ShieldCheck className="w-12 h-12 text-primary animate-pulse" />

          {/* Decorative rings */}
          <div className="absolute inset-0 border border-primary/10 rounded-full animate-ping animation-duration-[3s]" />
          <div className="absolute -inset-2 border border-primary/5 rounded-full animate-ping animation-duration-[4.5s]" />
        </div>
      </div>

      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight bg-linear-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
          {messages.title}
        </h2>
        <p className="text-muted-foreground text-lg italic font-medium">
          "{messages.challenge}"
        </p>
        <p className="text-muted-foreground text-lg italic font-medium">
          "{messages.checking}"
        </p>
      </div>

      {/* Loading indicator */}
      <div className="flex gap-1.5 mt-2">
        <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.3s]" />
        <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.15s]" />
        <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" />
      </div>
    </div>
  );
}
