import { Suspense, ViewTransition } from "react";
import { ChatToggle } from "@/components/chat-bot/chat-toggle";
import { Menu } from "@/components/menu";
import { ScrollAwareHeader } from "@/components/scroll-aware-header";
import { SearchDialog } from "@/components/search-dialog";
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
  const authEnabled = hasAuth();
  const doubanEnabled = hasDoubanTop250();
  const [recommendations, doubanItems] = await Promise.all([
    getRecommendations(),
    doubanEnabled ? getDoubanTop250(0, 50) : [],
  ]);

  return (
    <ScrollAwareHeader>
      <header className="sticky top-0 w-full z-50 transition-colors duration-300 border-b border-transparent bg-transparent data-[scrolled=true]:bg-background/80 data-[scrolled=true]:backdrop-blur-md data-[scrolled=true]:border-border">
        <div className="px-6 md:px-8 lg:px-10">
          <div className="flex items-center justify-between h-16">
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
              <SearchDialog
                dictionary={messages}
                recommendations={recommendations}
              />
              <Suspense fallback={null}>
                <SuspendedChatToggle dictionary={messages.chat} />
              </Suspense>
              <ColorSchemeToggle aria-label={messages.common["color-scheme"]} />
              {authEnabled ? <AuthButtons dictionary={messages.auth} /> : null}
            </div>
          </div>
        </div>
      </header>
    </ScrollAwareHeader>
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
