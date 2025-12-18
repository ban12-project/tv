import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense, ViewTransition } from "react";
import Header from "@/components/header";
import Lock from "@/components/lock";
import { auth } from "@/lib/auth";

export default function ProtectedLayout(props: LayoutProps<"/[lang]">) {
  return (
    <>
      <Header />

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
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return redirect("/sign-in");
  }
  return children;
}
