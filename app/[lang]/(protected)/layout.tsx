import { Loader2 } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense, ViewTransition } from "react";
import Header from "@/components/header";
import { auth } from "@/lib/auth";

export default function ProtectedLayout(props: LayoutProps<"/[lang]">) {
  return (
    <ViewTransition>
      <Suspense
        fallback={
          <div className="flex h-screen items-center justify-center">
            <Loader2 className="animate-spin" />
          </div>
        }
      >
        <Suspended {...props}>
          <Header />
          {props.children}
        </Suspended>
      </Suspense>
    </ViewTransition>
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
