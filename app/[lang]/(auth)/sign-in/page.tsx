import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SignInForm } from "@/components/signin-form";
import { getDictionary } from "@/get-dictionary";
import type { Locale } from "@/i18n-config";
import { hasAuth } from "@/lib/features";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ lang: Locale }>;
}) {
  if (!hasAuth()) {
    notFound();
  }

  const { lang } = await params;
  const dictionary = await getDictionary(lang);

  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Suspense
          fallback={
            <div className="text-sm text-muted-foreground">
              {dictionary.common.loading}
            </div>
          }
        >
          <SignInForm dictionary={dictionary.auth.signIn} />
        </Suspense>
      </div>
    </div>
  );
}
