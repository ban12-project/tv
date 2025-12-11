import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Header from "@/components/header";
import { auth } from "@/lib/auth";

export default async function ProtectedLayout({
  children,
}: LayoutProps<"/[lang]">) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return redirect("/sign-in");
  }

  return (
    <>
      <Header />
      {children}
    </>
  );
}
