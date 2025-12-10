import { MacCMSAdapter } from "./adapters/mac-cms-adapter";
import type { VideoSourceAdapter } from "./adapters/types";

// Factory to get the correct adapter
export function getSourceProvider(): VideoSourceAdapter {
  const apiUrl = process.env.MACCMS_API_URL;

  if (apiUrl) {
    return new MacCMSAdapter(apiUrl);
  }

  throw new Error("MACCMS_API_URL not configured");
}

export const sourceProvider = getSourceProvider();
