import { APIError } from "better-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense, ViewTransition } from "react";
import Bailiff from "@/components/bailiff";
import { ChatWidget } from "@/components/chat-bot/chat-widget";
import Header from "@/components/header";
import { getDictionary } from "@/get-dictionary";
import type { Locale } from "@/i18n-config";
import { getAuth } from "@/lib/auth";
import { hasAuth, hasChatbot, isAuthRequired } from "@/lib/features";

export default async function ProtectedLayout(props: LayoutProps<"/[lang]">) {
  const { lang } = await props.params;
  const dict = await getDictionary(lang as Locale);
  const chatEnabled = hasChatbot() && (await hasRegisteredUser());

  return (
    <section className="flex min-w-0">
      <div className="flex-1 min-w-0">
        <Header messages={dict} />

        <Suspense
          fallback={
            <ViewTransition>
              <div className="flex items-center justify-center h-[calc(100vh-56px)]">
                <Bailiff messages={dict.protected.bailiff} />
              </div>
            </ViewTransition>
          }
        >
          <ViewTransition>
            <Suspended {...props} />
          </ViewTransition>
        </Suspense>
      </div>
      {chatEnabled ? <ChatWidget dictionary={dict} /> : null}
    </section>
  );
}

async function Suspended({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isAuthRequired()) {
    return children;
  }

  try {
    const session = await getAuth().api.getSession({
      headers: await headers(),
    });

    if (!session) {
      redirect(`/${lang}/sign-in`);
    }

    if (session.user.isAnonymous) {
      redirect(`/${lang}/sign-in?error=invalid_session`);
    }
  } catch (error) {
    if (error instanceof APIError) {
      redirect(`/${lang}/sign-in?error=invalid_session`);
    }
  }

  return children;
}

async function hasRegisteredUser() {
  if (!hasAuth()) return false;

  try {
    const session = await getAuth().api.getSession({
      headers: await headers(),
    });

    return Boolean(session && !session.user.isAnonymous);
  } catch {
    return false;
  }
}
