"use client";

import { Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import {
  addToAllowList,
  getAllowList,
  removeFromAllowList,
} from "@/app/actions";
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

export function AllowlistDialog() {
  const [emails, setEmails] = React.useState<{ id: string; email: string }[]>(
    [],
  );
  const [newEmail, setNewEmail] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isAdding, setIsAdding] = React.useState(false);

  const fetchEmails = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getAllowList();
      setEmails(data);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Failed to fetch allowlist";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;

    setIsAdding(true);
    try {
      await addToAllowList(newEmail);
      toast.success("Email added to allowlist");
      setNewEmail("");
      fetchEmails();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Failed to add email";
      toast.error(message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await removeFromAllowList(id);
      toast.success("Email removed from allowlist");
      fetchEmails();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "Failed to remove email";
      toast.error(message);
    }
  };

  return (
    <Dialog onOpenChange={(open) => open && fetchEmails()}>
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

        <form onSubmit={handleAdd} className="flex gap-2 mt-4">
          <Input
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

        <div className="mt-6 max-h-[300px] overflow-y-auto rounded-md border border-white/10">
          <Table>
            <TableHeader className="bg-white/5 sticky top-0 z-10">
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-white/60">Email</TableHead>
                <TableHead className="text-right text-white/60">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-white/20" />
                  </TableCell>
                </TableRow>
              ) : emails.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={2}
                    className="text-center py-8 text-white/20"
                  >
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(item.id)}
                        className="text-white/40 hover:text-red-400 hover:bg-red-400/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
