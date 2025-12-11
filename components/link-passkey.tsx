"use client";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { getCallbackURL } from "@/lib/utils";

const schema = z.object({
  email: z.email(),
});

export default function LinkPasskey() {
  const [isPending, startTransition] = React.useTransition();
  const router = useRouter();
  const params = useSearchParams();
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const validateFields = schema.safeParse({ email: formData.get("email") });
    if (!validateFields.success) {
      return;
    }
    // const { email } = validateFields.data;
    startTransition(async () => {
      await authClient.signIn.passkey({
        // autoFill: true,
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
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className="hidden sm:flex">
          Link Passkey
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Link Passkey</DialogTitle>
            <DialogDescription>
              Link your passkey to your account.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <div className="grid flex-1 gap-2">
              <Label htmlFor="webauthn" className="sr-only">
                webauthn
              </Label>
              <Input id="webauthn" name="email" type="email" />
            </div>
          </div>
          <DialogFooter className="sm:justify-start">
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Link
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
