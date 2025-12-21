import { Suspense } from "react";
import { SignInForm } from "@/components/signin-form";
import { getDictionary } from "@/get-dictionary";
import type { Locale } from "@/i18n-config";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ lang: Locale }>;
}) {
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
