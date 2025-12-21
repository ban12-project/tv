import { APIError } from "better-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense, ViewTransition } from "react";
import Header from "@/components/header";
import Lock from "@/components/lock";
import { auth } from "@/lib/auth";

export default function ProtectedLayout(props: LayoutProps<"/[lang]">) {
  return (
    <>
      <Header params={props.params} />

      <Suspense
        fallback={
          <ViewTransition>
            <div className="flex h-screen items-center justify-center">
              <Lock />
            </div>
          </ViewTransition>
        }
      >
        <ViewTransition>
          <Suspended {...props}>{props.children}</Suspended>
        </ViewTransition>
      </Suspense>
    </>
  );
}

async function Suspended({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  try {
    const session = await auth.api.getSession({
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
