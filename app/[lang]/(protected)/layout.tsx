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

async function Suspended({ children }: LayoutProps<"/[lang]">) {
  let session: Awaited<ReturnType<typeof auth.api.getSession>> | null = null;

  try {
    session = await auth.api.getSession({
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) {
      redirect("/sign-in");
    }
  }

  if (!session) {
    redirect("/sign-in");
  }

  if (session.user.isAnonymous) {
    redirect("/sign-in");
  }

  return children;
}
