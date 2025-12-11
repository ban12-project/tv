import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import type { ReadonlyURLSearchParams } from "next/navigation";

const allowedCallbackSet: ReadonlySet<string> = new Set([
  "/dashboard",
  "/device",
]);

export const getCallbackURL = (
  queryParams: ReadonlyURLSearchParams,
): string => {
  const callbackUrl = queryParams.get("callbackUrl");
  if (callbackUrl) {
    if (allowedCallbackSet.has(callbackUrl)) {
      return callbackUrl;
    }
    return "/";
  }
  return "/";
};
