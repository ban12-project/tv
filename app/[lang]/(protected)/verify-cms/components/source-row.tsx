"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { deleteApiSource } from "@/lib/actions/cms";
import type { SelectApiSource } from "@/lib/db/schema";

const initialState = {
  success: false,
  timestamp: 0,
  error: "",
};

export default function SourceRow({ source }: { source: SelectApiSource }) {
  const [state, dispatch, isPending] = useActionState(
    deleteApiSource,
    initialState,
  );

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <TableRow className="border-border hover:bg-muted data-[state=active]:bg-muted">
      <TableCell className="font-medium">{source.name}</TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground break-all">
        {source.url}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="uppercase text-[10px]">
          {source.type}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <form action={dispatch}>
          <input type="hidden" name="id" value={source.id} />
          <Button
            variant="ghost"
            size="icon"
            type="submit"
            disabled={isPending}
            className="text-destructive/50 hover:text-destructive hover:bg-destructive/10"
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
  );
}
