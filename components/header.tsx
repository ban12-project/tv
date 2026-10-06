import { io } from "next/cache";
import { type ReactNode, Suspense, ViewTransition } from "react";
import { ChatToggle } from "@/components/chat-bot/chat-toggle";
import { Menu } from "@/components/menu";
import { ScrollAwareHeader } from "@/components/scroll-aware-header";
import { SearchDialog } from "@/components/search-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { Messages } from "@/get-dictionary";
import { getAllowList } from "@/lib/actions";
import { getDoubanTop250 } from "@/lib/actions/douban";
import { getRecommendations } from "@/lib/actions/recommendations";
import { getCurrentSession } from "@/lib/auth-utils";
import {
  hasAuth,
  hasChatbot,
  hasCmsAdmin,
  hasDoubanTop250,
} from "@/lib/features";
import { AllowlistDialog } from "./allowlist-dialog";
import { AuthButtons } from "./auth-buttons";
import ColorSchemeToggle from "./color-scheme-toggle-client";
import { EmojiLogo } from "./emoji-logo";

export default async function Header({ messages }: { messages: Messages }) {
  // Optional service settings are supplied when the container starts. Keep
  // their menu tree out of build-time HTML so it matches the streamed RSC tree.
  await io();
  const authEnabled = hasAuth();
  const doubanEnabled = hasDoubanTop250();
  const [recommendationsResult, doubanResult] = await Promise.allSettled([
    getRecommendations(),
    doubanEnabled ? getDoubanTop250(0, 50) : [],
  ]);
  const recommendations =
    recommendationsResult.status === "fulfilled"
      ? recommendationsResult.value
      : [];
  const doubanItems =
    doubanResult.status === "fulfilled" ? doubanResult.value : [];
  if (recommendationsResult.status === "rejected") {
    console.error(
      "Failed to load header recommendations:",
      recommendationsResult.reason,
    );
  }
  if (doubanResult.status === "rejected") {
    console.error("Failed to load header ranking:", doubanResult.reason);
  }

  return (
    <HeaderShell>
      {/* Logo and Navigation */}
      <div className="flex items-center gap-4">
        <EmojiLogo />

        <Suspense
          fallback={
            <Menu
              recommendations={recommendations}
              doubanItems={doubanItems}
              dictionary={messages}
              doubanEnabled={doubanEnabled}
              cmsAdminEnabled={false}
            />
          }
        >
          <SuspendedMenu
            recommendations={recommendations}
            doubanItems={doubanItems}
            dictionary={messages}
            doubanEnabled={doubanEnabled}
            authEnabled={authEnabled}
          />
        </Suspense>
      </div>

      {/* Search and Sign In */}
      <div className="flex items-center gap-4">
        <SearchDialog dictionary={messages} recommendations={recommendations} />
        <Suspense fallback={null}>
          <SuspendedChatToggle dictionary={messages.chat} />
        </Suspense>
        <ColorSchemeToggle aria-label={messages.common["color-scheme"]} />
        {authEnabled ? <AuthButtons dictionary={messages.auth} /> : null}
      </div>
    </HeaderShell>
  );
}

function HeaderShell({
  children,
  loading = false,
}: {
  children: ReactNode;
  loading?: boolean;
}) {
  return (
    <ScrollAwareHeader>
      <header
        aria-busy={loading}
        className="sticky top-0 shrink-0 w-full z-50 transition-colors duration-300 border-b border-transparent bg-transparent data-[scrolled=true]:bg-background/80 data-[scrolled=true]:backdrop-blur-md data-[scrolled=true]:border-border"
      >
        <div className="px-4 sm:px-6 md:px-8 lg:px-10">
          <div className="flex flex-wrap items-center justify-between min-h-16 gap-x-4 gap-y-2 py-2">
            {children}
          </div>
        </div>
      </header>
    </ScrollAwareHeader>
  );
}

export function HeaderLoading({ messages }: { messages: Messages }) {
  return (
    <HeaderShell loading>
      <div
        className="flex items-center gap-4"
        role="status"
        aria-label={messages.common.loading}
      >
        <EmojiLogo />
        <Skeleton className="hidden md:block h-9 w-32" />
        <Skeleton className="md:hidden size-9" />
      </div>
      <div className="flex items-center gap-4" aria-hidden="true">
        <Skeleton className="size-9" />
        <Skeleton className="w-18.5 h-6.5 rounded-full" />
        {hasAuth() ? <Skeleton className="size-9" /> : null}
      </div>
    </HeaderShell>
  );
}

async function SuspendedMenu({
  recommendations,
  doubanItems,
  dictionary,
  doubanEnabled,
  authEnabled,
}: {
  recommendations: Awaited<ReturnType<typeof getRecommendations>>;
  doubanItems: Awaited<ReturnType<typeof getDoubanTop250>>;
  dictionary: Messages;
  doubanEnabled: boolean;
  authEnabled: boolean;
}) {
  const isRealUser = await hasRegisteredUser();

  return (
    <Menu
      recommendations={recommendations}
      doubanItems={doubanItems}
      dictionary={dictionary}
      doubanEnabled={doubanEnabled}
      cmsAdminEnabled={hasCmsAdmin() && isRealUser}
    >
      {authEnabled && isRealUser ? (
        <ViewTransition>
          <SuspendedAllowlistDialog messages={dictionary} />
        </ViewTransition>
      ) : null}
    </Menu>
  );
}

async function SuspendedAllowlistDialog({ messages }: { messages: Messages }) {
  const emailsPromise = getAllowList();

  return (
    <AllowlistDialog emailsPromise={emailsPromise} dictionary={messages} />
  );
}

async function SuspendedChatToggle({
  dictionary,
}: {
  dictionary: Messages["chat"];
}) {
  if (!hasChatbot() || !(await hasRegisteredUser())) return null;

  return <ChatToggle dictionary={dictionary} />;
}

async function hasRegisteredUser() {
  if (!hasAuth()) return false;

  const session = await getCurrentSession().catch(() => null);
  return Boolean(session && !session.user.isAnonymous);
}
