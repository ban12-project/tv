"use client";

import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import * as z from "zod";
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
import { checkRegistrationStatus, preUpgradeAnonymous } from "@/lib/actions";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const schema = z.object({
  email: z.email(),
});

export function SignupForm({
  className,
  dictionary,
  ...props
}: React.ComponentProps<"div"> & {
  dictionary: Messages["auth"]["signUp"];
}) {
  const [isPending, startTransition] = React.useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const validatedFields = schema.safeParse({
      email: formData.get("email"),
    });
    if (!validatedFields.success) {
      toast.error(
        z.flattenError(validatedFields.error).fieldErrors.email?.join(", "),
      );
      return;
    }
    const { email } = validatedFields.data;

    startTransition(async () => {
      const { allowed, registered } = await checkRegistrationStatus(email);
      if (!allowed) {
        toast.error(dictionary.notInAllowlist);
        return;
      }

      if (registered) {
        toast.info(dictionary.accountExists);
        await authClient.signIn.passkey({
          fetchOptions: {
            onSuccess() {
              toast.success(dictionary.signInSuccess);
              router.push(searchParams.get("callbackUrl") || "/");
            },
            onError(context) {
              toast.error(
                dictionary.signInFailed.replace(
                  "{error}",
                  context.error.message,
                ),
              );
            },
          },
        });
        return;
      }

      await authClient.signIn.anonymous({
        fetchOptions: {
          onError(context) {
            toast.error(
              dictionary.failed.replace("{error}", context.error.message),
            );
          },
        },
      });
      await authClient.passkey.addPasskey({
        name: email,
        fetchOptions: {
          async onSuccess() {
            await preUpgradeAnonymous(email);
            toast.success(dictionary.success);
            const callbackUrl = searchParams.get("callbackUrl") || "/";
            router.push(callbackUrl);
          },
          onError(context) {
            toast.error(
              dictionary.passkeyFailed.replace(
                "{error}",
                context.error.message,
              ),
            );
          },
        },
      });
    });
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={onSubmit}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <FieldDescription>
              {dictionary.alreadyHaveAccount}{" "}
              <Link href="/sign-in">{dictionary.signIn}</Link>
            </FieldDescription>
          </div>
          <Field>
            <FieldLabel htmlFor="email">{dictionary.email}</FieldLabel>
            <Input
              name="email"
              type="email"
              placeholder={dictionary.emailPlaceholder}
              required
            />
          </Field>
          <Field>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {dictionary.createAccount}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  );
}
