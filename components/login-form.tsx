"use client";

import { Key, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signIn } from "@/lib/auth-client";
import { cn, getCallbackURL } from "@/lib/utils";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [isPending, startTransition] = React.useTransition();
  const router = useRouter();
  const params = useSearchParams();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      await signIn.passkey({
        autoFill: true,
        fetchOptions: {
          onSuccess() {
            toast.success("Successfully signed in");
            router.push(getCallbackURL(params));
          },
          onError(context) {
            toast.error(`Authentication failed: ${context.error.message}`);
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
              Don&apos;t have an account? <Link href="/sign-up">Sign up</Link>
            </FieldDescription>
          </div>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              required
              autoComplete="webauthn"
            />
          </Field>
          <Field>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Key size={16} />
              <span>Sign in with Passkey</span>
            </Button>
          </Field>
          <FieldSeparator>Or</FieldSeparator>
          <Field>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                signIn.anonymous({
                  fetchOptions: {
                    onSuccess() {
                      toast.success("Successfully signed in");
                      router.push(getCallbackURL(params));
                    },
                    onError(context) {
                      toast.error(
                        `Authentication failed: ${context.error.message}`,
                      );
                    },
                  },
                })
              }
            >
              Sign in with Anonymous
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  );
}
