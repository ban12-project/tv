"use client";

import { Loader2, ThumbsDown, ThumbsUp } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { Messages } from "@/get-dictionary";
import type { AdSkipFeedbackPayload } from "@/lib/player/ad-feedback";

interface AdSkipFeedbackDialogProps {
  dictionary: Messages;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  payload: AdSkipFeedbackPayload | null;
}

export function AdSkipFeedbackDialog({
  dictionary,
  onOpenChange,
  open,
  payload,
}: AdSkipFeedbackDialogProps) {
  const [showNegativeForm, setShowNegativeForm] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const t = dictionary.watch["ad-feedback"];

  React.useEffect(() => {
    if (!open) {
      setShowNegativeForm(false);
      setNote("");
      setIsSubmitting(false);
    }
  }, [open]);

  const handleExpected = () => {
    onOpenChange(false);
  };

  const handleSubmitNegative = async () => {
    if (!payload) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/ad-feedback", {
        body: JSON.stringify({
          ...payload,
          note: note.trim() || undefined,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Feedback failed: ${response.status}`);
      }

      toast.success(t.success);
      onOpenChange(false);
    } catch (error) {
      console.error("[AdSkipFeedbackDialog] Failed to submit feedback:", error);
      toast.error(t.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card text-card-foreground border-border shadow-2xl">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>

        {showNegativeForm ? (
          <div className="grid gap-3">
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t.placeholder}
              className="min-h-24 resize-none"
              maxLength={4000}
            />
          </div>
        ) : null}

        <DialogFooter>
          {showNegativeForm ? (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowNegativeForm(false)}
                disabled={isSubmitting}
              >
                {t.back}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleSubmitNegative}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ThumbsDown className="size-4" />
                )}
                {isSubmitting ? t.submitting : t.submit}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={handleExpected}
              >
                <ThumbsUp className="size-4" />
                {t.expected}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowNegativeForm(true)}
              >
                <ThumbsDown className="size-4" />
                {t.unexpected}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
