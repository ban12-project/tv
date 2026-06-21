export type CmsSourceType = "json" | "xml" | "csv";

export type EnvCmsSource = {
  id: string;
  name: string;
  url: string;
  type: CmsSourceType;
};

const CMS_SOURCE_TYPES = new Set<CmsSourceType>(["json", "xml", "csv"]);
const ACCESS_MODES = new Set(["private", "public"]);

function hasValue(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function hasDatabase() {
  return hasValue(process.env.DATABASE_URL);
}

export function hasAuth() {
  return (
    hasDatabase() &&
    hasValue(process.env.BETTER_AUTH_SECRET) &&
    hasValue(process.env.BETTER_AUTH_URL)
  );
}

export function getAccessMode() {
  const mode = process.env.ACCESS_MODE?.trim().toLowerCase();
  if (mode && ACCESS_MODES.has(mode)) return mode as "private" | "public";
  return hasAuth() ? "private" : "public";
}

export function isAuthRequired() {
  return hasAuth() && getAccessMode() === "private";
}

export function hasDoubanTop250() {
  return (
    hasValue(process.env.SUPABASE_ENDPOINT) &&
    hasValue(process.env.SUPABASE_ANON_KEY)
  );
}

export function hasChatbot() {
  return (
    hasAuth() &&
    hasValue(process.env.OPENAI_API_KEY) &&
    hasValue(process.env.CF_AIG_TOKEN) &&
    hasValue(process.env.CLOUDFLARE_ACCOUNT_ID)
  );
}

export function hasCmsAdmin() {
  return hasDatabase() && hasAuth();
}

export function parseEnvCmsSources(): EnvCmsSource[] {
  const raw = process.env.MAC_CMS_SOURCES;
  if (!hasValue(raw)) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("MAC_CMS_SOURCES must be a JSON array.");
    return [];
  }

  if (!Array.isArray(parsed)) {
    console.error("MAC_CMS_SOURCES must be a JSON array.");
    return [];
  }

  return parsed.flatMap((item) => {
    if (!item || typeof item !== "object") return [];

    const source = item as Record<string, unknown>;
    const id = typeof source.id === "string" ? source.id.trim() : "";
    const name = typeof source.name === "string" ? source.name.trim() : "";
    const url = typeof source.url === "string" ? source.url.trim() : "";
    const rawType =
      typeof source.type === "string" ? source.type.trim() : "json";
    const type = CMS_SOURCE_TYPES.has(rawType as CmsSourceType)
      ? (rawType as CmsSourceType)
      : "json";

    if (!id || !name || !url) return [];

    try {
      new URL(url);
    } catch {
      console.error(`Ignoring MAC_CMS_SOURCES entry with invalid URL: ${id}`);
      return [];
    }

    return [{ id, name, url, type }];
  });
}
