"use client";

import { Loader2, LogIn, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "@/components/link";
import { Button } from "@/components/ui/button";
import type { Messages } from "@/get-dictionary";
import { authClient } from "@/lib/auth-client";

export function AuthButtons({ dictionary }: { dictionary: Messages["auth"] }) {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          toast.success(dictionary.signOut.success);
          router.push("/");
          router.refresh();
        },
        onError: (context) => {
          toast.error(
            dictionary.signOut.failed.replace("{error}", context.error.message),
          );
        },
      },
    });
  };

  if (isPending) {
    return (
      <Button variant="ghost" size="icon" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  if (session && !session.user.isAnonymous) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={handleSignOut}
        title={dictionary.signOut.title}
      >
        <LogOut className="h-4 w-4" />
        <span className="sr-only">{dictionary.signOut.title}</span>
      </Button>
    );
  }

  return (
    <Button variant="ghost" size="icon" asChild title={dictionary.signIn.title}>
      <Link href="/sign-in">
        <LogIn className="h-4 w-4" />
        <span className="sr-only">{dictionary.signIn.title}</span>
      </Link>
    </Button>
  );
}
