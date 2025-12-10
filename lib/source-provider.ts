import { MacCMSAdapter } from "./adapters/mac-cms-adapter";

// Factory to get the correct adapter
export function getSourceProvider() {
  const apiUrl = process.env.MACCMS_API_URL;

  if (apiUrl) {
    return new MacCMSAdapter(apiUrl);
  }

  throw new Error("MACCMS_API_URL not configured");
}

export const sourceProvider = getSourceProvider();
