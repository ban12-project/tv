"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import * as z from "zod";
import {
  checkEmail,
  checkRegistrationStatus,
  preUpgradeAnonymous,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { cn, getCallbackURL } from "@/lib/utils";

const schema = z.object({
  email: z.email(),
});

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
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
      const valid = await checkEmail(email);
      if (!valid) {
        toast.error("This email is not in the allowlist.");
        return;
      }

      const { registered } = await checkRegistrationStatus(email);
      if (registered) {
        toast.info("Account already exists. Signing you in...");
        await authClient.signIn.passkey({
          fetchOptions: {
            onSuccess() {
              toast.success("Successfully signed in");
              router.push(getCallbackURL(searchParams));
            },
            onError(context) {
              toast.error(`Sign in failed: ${context.error.message}`);
            },
          },
        });
        return;
      }

      await authClient.signIn.anonymous({
        fetchOptions: {
          onError(context) {
            toast.error(`Authentication failed: ${context.error.message}`);
          },
        },
      });
      await authClient.passkey.addPasskey({
        name: email,
        fetchOptions: {
          async onSuccess() {
            await preUpgradeAnonymous(email);
            toast.success("Account successfully upgraded and passkey linked!");
            const callbackUrl = getCallbackURL(searchParams);
            router.push(callbackUrl);
          },
          onError(context) {
            toast.error(
              `Passkey registration failed: ${context.error.message}`,
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
              Already have an account? <Link href="/sign-in">Sign in</Link>
            </FieldDescription>
          </div>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              name="email"
              type="email"
              placeholder="m@example.com"
              required
            />
          </Field>
          <Field>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  );
}
