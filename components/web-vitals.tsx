"use client";

import { sendGAEvent } from "@next/third-parties/google";
import { useReportWebVitals } from "next/web-vitals";

type ReportWebVitalsCallback = Parameters<typeof useReportWebVitals>[0];

const reportWebVitals: ReportWebVitalsCallback = (metric) => {
  sendGAEvent("event", metric.name, {
    event_label: metric.id,
    non_interaction: true,
    value: Math.round(
      metric.name === "CLS" ? metric.value * 1000 : metric.value,
    ),
  });
};

export function WebVitals() {
  useReportWebVitals(reportWebVitals);

  return null;
}
