"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const schema = z.object({
  email: z.email(),
});

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [isPending, startTransition] = React.useTransition();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const validatedFields = schema.safeParse({ email: formData.get("email") });
    if (!validatedFields.success) {
      toast.error(
        z.flattenError(validatedFields.error).fieldErrors.email?.join(", "),
      );
      return;
    }
    const { email } = validatedFields.data;

    startTransition(async () => {
      const { error } = await authClient.passkey.addPasskey({
        name: email,
        authenticatorAttachment: "cross-platform",
      });
      if (error) {
        toast.error(`${error.statusText} ${error.message}`);
      }
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
              id="email"
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
