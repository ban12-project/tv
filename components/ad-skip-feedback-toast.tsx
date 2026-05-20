"use client";

import { toast } from "sonner";
import type { Messages } from "@/get-dictionary";
import type { AdSkipFeedbackPayload } from "@/lib/player/ad-feedback";

const AD_FEEDBACK_TOAST_DURATION_MS = 5000;

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
  let isSubmitting = false;

  const toastId = toast(t.title, {
    action: {
      label: t.unexpected,
      onClick: async (event) => {
        event.preventDefault();
        if (isSubmitting) return;

        isSubmitting = true;
        toast.loading(t.submitting, {
          action: undefined,
          cancel: undefined,
          description: undefined,
          id: toastId,
        });

        try {
          await submitAdSkipFeedback(payload);
          toast.success(t.success, {
            duration: AD_FEEDBACK_TOAST_DURATION_MS,
            id: toastId,
          });
        } catch (error) {
          console.error(
            "[AdSkipFeedbackToast] Failed to submit feedback:",
            error,
          );
          toast.error(t.error, {
            duration: AD_FEEDBACK_TOAST_DURATION_MS,
            id: toastId,
          });
        }
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
