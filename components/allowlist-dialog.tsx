"use client";

import { Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Messages } from "@/get-dictionary";
import { addToAllowList, removeFromAllowList } from "@/lib/actions";

const initialState = {
  error: "",
  success: false,
  timestamp: 0,
};

export function AllowlistDialog({
  emailsPromise,
  dictionary,
}: {
  emailsPromise: Promise<{ id: string; email: string }[]>;
  dictionary: Messages;
}) {
  const [newEmail, setNewEmail] = React.useState("");

  const [state, dispatch, isAdding] = React.useActionState(
    addToAllowList,
    initialState,
  );

  React.useEffect(() => {
    if (state.timestamp > 0) {
      if (state.success) {
        toast.success(dictionary.allowlist["add-success"]);
        setNewEmail("");
      } else if (state.error) {
        toast.error(state.error);
      }
    }
  }, [state, dictionary]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 text-foreground">
          <ShieldCheck className="h-4 w-4" />
          {dictionary.allowlist.button}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg border-border bg-background/80 backdrop-blur-2xl text-foreground">
        <DialogHeader>
          <DialogTitle>{dictionary.allowlist.title}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {dictionary.allowlist.description}
          </DialogDescription>
        </DialogHeader>

        <form action={dispatch} className="flex gap-2 mt-4">
          <Input
            name="email"
            placeholder={dictionary.allowlist.placeholder}
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="border-border bg-muted text-foreground placeholder:text-muted-foreground/50"
          />
          <Button
            type="submit"
            disabled={isAdding || !newEmail}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isAdding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </form>

        <div className="mt-6 max-h-75 overflow-y-auto rounded-md border border-white/10">
          <React.Suspense
            fallback={
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/20" />
              </div>
            }
          >
            <AllowlistList
              emailsPromise={emailsPromise}
              dictionary={dictionary}
            />
          </React.Suspense>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AllowlistList({
  emailsPromise,
  dictionary,
}: {
  emailsPromise: Promise<{ id: string; email: string }[]>;
  dictionary: Messages;
}) {
  const emails = React.use(emailsPromise);

  const [state, dispatch, isPending] = React.useActionState(
    removeFromAllowList,
    initialState,
  );

  React.useEffect(() => {
    if (state.timestamp > 0) {
      if (state.success) {
        toast.success(dictionary.allowlist["remove-success"]);
      } else if (state.error) {
        toast.error(state.error);
      }
    }
  }, [state, dictionary]);

  return (
    <Table>
      <TableHeader className="bg-muted sticky top-0 z-10">
        <TableRow className="border-border hover:bg-transparent">
          <TableHead className="text-muted-foreground/60">
            {dictionary.allowlist["table-email"]}
          </TableHead>
          <TableHead className="text-right text-muted-foreground/60">
            {dictionary.allowlist["table-actions"]}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {emails.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={2}
              className="text-center py-8 text-muted-foreground/20"
            >
              {dictionary.allowlist.empty}
            </TableCell>
          </TableRow>
        ) : (
          emails.map((item) => (
            <TableRow
              key={item.id}
              className="border-border hover:bg-muted transition-colors"
            >
              <TableCell className="font-medium">{item.email}</TableCell>
              <TableCell className="text-right">
                <form action={dispatch}>
                  <input type="hidden" name="id" value={item.id} />
                  <Button
                    variant="ghost"
                    size="icon"
                    type="submit"
                    disabled={isPending}
                    className="text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10"
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </form>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
