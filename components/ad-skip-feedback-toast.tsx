"use client";

import { toast } from "sonner";
import type { Messages } from "@/get-dictionary";
import type { AdSkipFeedbackPayload } from "@/lib/player/ad-feedback";
import { cn, formatTime } from "@/lib/utils";

const AD_FEEDBACK_TOAST_DURATION_MS = 5000;
const AD_FEEDBACK_LIST_TOAST_DURATION_MS = 10_000;

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

export function showAdSkipFeedbackListToast(
  dictionary: Messages,
  payloads: AdSkipFeedbackPayload[],
) {
  const t = dictionary.watch["ad-feedback"];

  if (payloads.length === 0) {
    toast.info(t.empty, {
      description: t["empty-description"],
      duration: AD_FEEDBACK_TOAST_DURATION_MS,
      position: "bottom-right",
    });
    return;
  }

  let isSubmitting = false;
  toast.custom(
    (id) => (
      <div className="w-[min(360px,calc(100vw-2rem))] rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-lg">
        <div className="mb-1 text-sm font-medium">{t.title}</div>
        <p className="mb-3 text-xs text-muted-foreground">
          {t["list-description"]}
        </p>
        <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
          {payloads.map((payload, index) => (
            <button
              className={cn(
                "rounded-md border border-border px-3 py-2 text-left text-xs transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
              key={`${payload.snapshot.createdAt}:${payload.snapshot.seek.from}:${payload.snapshot.seek.to}`}
              type="button"
              onClick={async () => {
                if (isSubmitting) return;

                isSubmitting = true;
                toast.loading(t.submitting, {
                  id,
                  position: "bottom-right",
                });

                try {
                  await submitAdSkipFeedback(payload);
                  toast.success(t.success, {
                    duration: AD_FEEDBACK_TOAST_DURATION_MS,
                    id,
                  });
                } catch (error) {
                  console.error(
                    "[AdSkipFeedbackToast] Failed to submit feedback:",
                    error,
                  );
                  toast.error(t.error, {
                    duration: AD_FEEDBACK_TOAST_DURATION_MS,
                    id,
                  });
                }
              }}
            >
              <span className="block font-medium">
                {t["range-label"].replace("{index}", String(index + 1))}
              </span>
              <span className="text-muted-foreground">
                {formatTime(payload.snapshot.seek.from)} {"->"}{" "}
                {formatTime(payload.snapshot.seek.to)}
              </span>
            </button>
          ))}
        </div>
      </div>
    ),
    {
      duration: AD_FEEDBACK_LIST_TOAST_DURATION_MS,
      position: "bottom-right",
    },
  );
}
