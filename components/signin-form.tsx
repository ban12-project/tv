"use client";

import { Key, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import Link from "@/components/link";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Messages } from "@/get-dictionary";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export function SignInForm({
  className,
  dictionary,
  ...props
}: React.ComponentProps<"div"> & {
  dictionary: Messages["auth"]["signIn"];
}) {
  const [isPending, startTransition] = React.useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      await authClient.signIn.passkey({
        fetchOptions: {
          onSuccess() {
            toast.success(dictionary.success);
            router.push(searchParams.get("callbackUrl") || "/");
          },
          onError(context) {
            toast.error(
              dictionary.failed.replace("{error}", context.error.message),
            );
          },
        },
      });
    });
  };

  React.useEffect(() => {
    if (
      !PublicKeyCredential.isConditionalMediationAvailable ||
      !PublicKeyCredential.isConditionalMediationAvailable()
    ) {
      return;
    }
    void authClient.signIn.passkey({ autoFill: true });
  }, []);

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={onSubmit}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <FieldDescription>
              {dictionary.dontHaveAccount}{" "}
              <Link href="/sign-up">{dictionary.signUp}</Link>
            </FieldDescription>
          </div>
          <Field>
            <FieldLabel htmlFor="email">{dictionary.email}</FieldLabel>
            <Input
              name="email"
              type="email"
              placeholder={dictionary.emailPlaceholder}
              required
              autoComplete="webauthn"
            />
          </Field>
          <Field>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Key size={16} />
              <span>{dictionary.signInWithPasskey}</span>
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  );
}
