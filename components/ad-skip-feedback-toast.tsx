"use client";

import { toast } from "sonner";
import type { Messages } from "@/get-dictionary";
import type { AdSkipFeedbackPayload } from "@/lib/player/ad-feedback";

const AD_FEEDBACK_TOAST_DURATION_MS = 3000;

async function submitAdSkipFeedback(payload: AdSkipFeedbackPayload) {
  const response = await fetch("/api/ad-feedback", {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Feedback failed: ${response.status}`);
  }
}

export function showAdSkipFeedbackToast(
  dictionary: Messages,
  payload: AdSkipFeedbackPayload,
) {
  const t = dictionary.watch["ad-feedback"];

  const toastId = toast(t.title, {
    action: {
      label: t.unexpected,
      onClick: (event) => {
        event.preventDefault();
        toast.promise(submitAdSkipFeedback(payload), {
          duration: AD_FEEDBACK_TOAST_DURATION_MS,
          error: (error) => {
            console.error(
              "[AdSkipFeedbackToast] Failed to submit feedback:",
              error,
            );
            return t.error;
          },
          id: toastId,
          loading: t.submitting,
          position: "bottom-right",
          success: t.success,
        });
      },
    },
    cancel: {
      label: t.expected,
      onClick: () => {},
    },
    description: t.description,
    duration: AD_FEEDBACK_TOAST_DURATION_MS,
    position: "bottom-right",
  });
}
