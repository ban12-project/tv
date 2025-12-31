"use client";

import { Loader2, ThumbsUp, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import {
  type ActionState,
  deleteRecommendation,
  saveRecommendation,
} from "@/app/actions/recommendations";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Messages } from "@/get-dictionary";

// Minimal type to avoid importing heavy types
export interface VideoPreview {
  title?: string;
  description?: string;
  image?: string;
  sourceId?: string;
  id?: string;
  ep?: string;
}

const initialState: ActionState = {
  success: false,
  error: undefined,
};

export function RecommendationDialog({
  video,
  dictionary,
  isRecommended: isRecommendedPromise,
}: {
  video: VideoPreview;
  dictionary: Messages;
  isRecommended: Promise<boolean>;
}) {
  const [open, setOpen] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);

  // Unwrap the promise using React.use()
  // This will suspend the component until the promise resolves
  const initialIsRecommended = React.use(isRecommendedPromise);

  const [isRecommended, setIsRecommended] =
    React.useState(initialIsRecommended);

  const [saveState, saveAction, isSavePending] = React.useActionState(
    saveRecommendation,
    initialState,
  );

  const [deleteState, deleteAction, isDeletePending] = React.useActionState(
    deleteRecommendation,
    initialState,
  );

  const t = dictionary.watch.recommendation;

  React.useEffect(() => {
    if (saveState.success) {
      toast.success(t.success);
      setOpen(false);
      setIsRecommended(true);
    }
  }, [saveState.success, t]);

  React.useEffect(() => {
    if (deleteState.success) {
      toast.success("Recommendation withdrawn");
      setIsRecommended(false);
    }
  }, [deleteState.success]);

  if (isRecommended) {
    return (
      <form action={deleteAction}>
        <input type="hidden" name="sourceId" value={video.sourceId || ""} />
        <input type="hidden" name="videoId" value={video.id || ""} />
        <input type="hidden" name="epIndex" value={video.ep || "1"} />
        <Button
          variant={isHovered ? "destructive" : "secondary"}
          size="sm"
          className="gap-2 min-w-32"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          type="submit"
          disabled={isDeletePending}
        >
          {isDeletePending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isHovered ? (
            <>
              <Trash2 className="h-4 w-4" />
              {t.withdraw}
            </>
          ) : (
            <>
              <ThumbsUp className="h-4 w-4 fill-current" />
              {t.recommended}
            </>
          )}
        </Button>
      </form>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ThumbsUp className="h-4 w-4" />
          {t.button}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg bg-card text-card-foreground border-border shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{t.title}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {t.description}
          </DialogDescription>
        </DialogHeader>
        <form action={saveAction} className="grid gap-4 py-4">
          <input type="hidden" name="sourceId" value={video.sourceId || ""} />
          <input type="hidden" name="videoId" value={video.id || ""} />
          <input type="hidden" name="epIndex" value={video.ep || "1"} />
          <div className="grid gap-2">
            <Label htmlFor="title">{t.label.title}</Label>
            <Input
              id="title"
              name="title"
              defaultValue={video.title}
              required
            />
            {saveState.error &&
              typeof saveState.error === "object" &&
              saveState.error.title && (
                <span className="text-xs text-destructive">
                  {saveState.error.title[0]}
                </span>
              )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">{t.label.description}</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={video.description}
              className="resize-none h-24"
              required
            />
            {saveState.error &&
              typeof saveState.error === "object" &&
              saveState.error.description && (
                <span className="text-xs text-destructive">
                  {saveState.error.description[0]}
                </span>
              )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="image">{t.label.image}</Label>
            <Input
              id="image"
              name="image"
              defaultValue={video.image}
              required
            />
            {saveState.error &&
              typeof saveState.error === "object" &&
              saveState.error.image && (
                <span className="text-xs text-destructive">
                  {saveState.error.image[0]}
                </span>
              )}
          </div>

          {saveState.error && typeof saveState.error === "string" && (
            <p className="text-sm text-destructive">{saveState.error}</p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isSavePending}>
              {isSavePending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isSavePending ? t.submitting : t.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
