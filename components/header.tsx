import { headers } from "next/headers";
import { Suspense, ViewTransition } from "react";
import { getAllowList } from "@/app/actions";
import { getRecommendations } from "@/app/actions/recommendations";
import { Menu } from "@/components/menu";
import { ScrollAwareHeader } from "@/components/scroll-aware-header";
import { SearchDialog } from "@/components/search-dialog";
import type { Messages } from "@/get-dictionary";
import { auth } from "@/lib/auth";
import { AllowlistDialog } from "./allowlist-dialog";
import ColorSchemeToggle from "./color-scheme-toggle-client";
import { EmojiLogo } from "./emoji-logo";

async function SuspendedMenu({
  children,
  messages,
}: {
  children?: React.ReactNode;
  messages: Messages;
}) {
  const recommendations = await getRecommendations();

  return (
    <Menu recommendations={recommendations} dictionary={messages}>
      {children}
    </Menu>
  );
}

export default function Header({ messages }: { messages: Messages }) {
  return (
    <ScrollAwareHeader>
      <header className="sticky top-0 w-full z-50 transition-colors duration-300 border-b border-transparent bg-transparent data-[scrolled=true]:bg-background/80 data-[scrolled=true]:backdrop-blur-md data-[scrolled=true]:border-border">
        <div className="px-6 md:px-8 lg:px-10">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Navigation */}
            <div className="flex items-center gap-4">
              <EmojiLogo />

              <ViewTransition>
                <Suspense>
                  <SuspendedMenu messages={messages}>
                    <SuspendedAllowlistDialog messages={messages} />
                  </SuspendedMenu>
                </Suspense>
              </ViewTransition>
            </div>

            {/* Search and Sign In */}
            <div className="flex items-center gap-4">
              <SearchDialog dictionary={messages} />
              <ColorSchemeToggle />
            </div>
          </div>
        </div>
      </header>
    </ScrollAwareHeader>
  );
}

async function SuspendedAllowlistDialog({ messages }: { messages: Messages }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const isRealUser = session && !session.user.isAnonymous;

  if (!isRealUser) return null;

  const emailsPromise = getAllowList();

  return (
    <AllowlistDialog emailsPromise={emailsPromise} dictionary={messages} />
  );
}
