"use client";

import { Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { addToAllowList, removeFromAllowList } from "@/app/actions";
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

const initialState = {
  error: "",
  success: false,
  timestamp: 0,
};

export function AllowlistDialog({
  emailsPromise,
}: {
  emailsPromise: Promise<{ id: string; email: string }[]>;
}) {
  const [newEmail, setNewEmail] = React.useState("");

  const [state, dispatch, isAdding] = React.useActionState(
    addToAllowList,
    initialState,
  );

  React.useEffect(() => {
    if (state.timestamp > 0) {
      if (state.success) {
        toast.success("Email added to allowlist");
        setNewEmail("");
      } else if (state.error) {
        toast.error(state.error);
      }
    }
  }, [state]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="hidden sm:flex gap-2 text-white/70 hover:text-white"
        >
          <ShieldCheck className="h-4 w-4" />
          Allowlist
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg border-white/10 bg-black/60 backdrop-blur-2xl text-white">
        <DialogHeader>
          <DialogTitle>Allowlist Management</DialogTitle>
          <DialogDescription className="text-white/40">
            Add or remove emails that are allowed to link passkeys and access
            protected content.
          </DialogDescription>
        </DialogHeader>

        <form action={dispatch} className="flex gap-2 mt-4">
          <Input
            name="email"
            placeholder="email@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="border-white/10 bg-white/5 text-white placeholder:text-white/30"
          />
          <Button
            type="submit"
            disabled={isAdding || !newEmail}
            className="bg-white text-black hover:bg-white/90"
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
                <Loader2 className="h-6 w-6 animate-spin text-white/20" />
              </div>
            }
          >
            <AllowlistList emailsPromise={emailsPromise} />
          </React.Suspense>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AllowlistList({
  emailsPromise,
}: {
  emailsPromise: Promise<{ id: string; email: string }[]>;
}) {
  const emails = React.use(emailsPromise);

  const [state, dispatch, isPending] = React.useActionState(
    removeFromAllowList,
    initialState,
  );

  React.useEffect(() => {
    if (state.timestamp > 0) {
      if (state.success) {
        toast.success("Email removed from allowlist");
      } else if (state.error) {
        toast.error(state.error);
      }
    }
  }, [state]);

  return (
    <Table>
      <TableHeader className="bg-white/5 sticky top-0 z-10">
        <TableRow className="border-white/10 hover:bg-transparent">
          <TableHead className="text-white/60">Email</TableHead>
          <TableHead className="text-right text-white/60">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {emails.length === 0 ? (
          <TableRow>
            <TableCell colSpan={2} className="text-center py-8 text-white/20">
              No allowlisted emails found.
            </TableCell>
          </TableRow>
        ) : (
          emails.map((item) => (
            <TableRow
              key={item.id}
              className="border-white/5 hover:bg-white/5 transition-colors"
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
                    className="text-white/40 hover:text-red-400 hover:bg-red-400/10"
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
