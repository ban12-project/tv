interface SkipRange {
  start: number;
  end: number;
}

const MAX_PLAYLIST_PARSE_DEPTH = 2;
const MANIFEST_LINE_BREAK = /\r\n|\r|\n/;
const MANIFEST_TAG_PREFIX = "#";

interface ParseManifestOptions {
  signal?: AbortSignal;
  timelineStart?: number;
}

interface ParsePlaylistTextOptions {
  timelineStart?: number;
}

function toFiniteNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTagAttributes(value: string): Record<string, string> {
  const result: Record<string, string> = {};
  const attributeText = value.replace(/^\s*:\s*/, "");
  if (!attributeText) return result;

  const attributes: string[] = [];
  let quote: string | null = null;
  let current = "";
  let escaped = false;

  for (let index = 0; index < attributeText.length; index++) {
    const char = attributeText[index];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\" && quote !== null) {
      current += char;
      escaped = true;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = quote === char ? null : char;
    }

    if (char === "," && quote === null) {
      attributes.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  if (current) {
    attributes.push(current);
  }

  for (const attribute of attributes) {
    const separatorIndex = attribute.indexOf("=");
    if (separatorIndex < 1) continue;

    const key = attribute.slice(0, separatorIndex).trim();
    const rawValue = attribute.slice(separatorIndex + 1).trim();
    if (!key || rawValue === undefined) continue;

    const quoteChar = rawValue[0];
    const isQuoted =
      (quoteChar === '"' || quoteChar === "'") &&
      rawValue.slice(-1) === quoteChar;
    const normalized = isQuoted
      ? rawValue.slice(1, -1).replace(/\\(["'\\])/g, "$1")
      : rawValue;
    result[key] = normalized;
  }

  return result;
}

function isAdLikeDaterange(attributes: Record<string, string>): boolean {
  const classValue = attributes.CLASS ?? "";
  const normalizedClass = classValue.toLowerCase();
  const classWords = normalizedClass.split(/[^a-z0-9]+/);
  const attributeText = Object.entries(attributes)
    .map(([key, value]) => `${key} ${value}`.toLowerCase())
    .join(" ");

  const adKeywords = [
    "ad",
    "advert",
    "commercial",
    "sponsor",
    "interstitial",
    "promo",
  ];

  return (
    adKeywords.some((keyword) => classWords.includes(keyword)) ||
    /\bad(s|vert(s|isement)?)?\b/.test(attributeText) ||
    /\bcommercial\b/.test(attributeText) ||
    /scte35/.test(attributeText)
  );
}

function mergeSkipRanges(ranges: SkipRange[]): SkipRange[] {
  const normalized = ranges
    .map((range) => ({
      start: Math.max(0, range.start),
      end: Math.max(0, range.end),
    }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const merged: SkipRange[] = [];
  for (const range of normalized) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push(range);
      continue;
    }

    const epsilon = 0.05;
    if (range.start <= last.end + epsilon) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push(range);
    }
  }

  return merged;
}

function parseCueDurationFromLine(line: string, prefix: string): number | null {
  const raw = line.substring(prefix.length).trim().replace(/^:/, "");
  const attrs = parseTagAttributes(raw);
  const durationFromAttrs = toFiniteNumber(getTagAttribute(attrs, "DURATION"));
  if (durationFromAttrs !== null) return durationFromAttrs;

  const match = raw.match(/^[\s]*([0-9]+(?:\.[0-9]+)?)/);
  if (match && !raw.includes("/")) {
    return toFiniteNumber(match[1]);
  }

  if (raw.includes("/")) {
    const segments = raw.trim().split("/");
    const lastSegment = segments[segments.length - 1];
    return toFiniteNumber(lastSegment);
  }

  return null;
}

function getTagAttribute(
  attributes: Record<string, string>,
  name: string,
): string | undefined {
  const normalizedName = name.toLowerCase();
  const found = Object.entries(attributes).find(
    ([key]) => key.toLowerCase() === normalizedName,
  );

  return found?.[1];
}

function parseCueOutContTiming(line: string): {
  duration: number | null;
  elapsed: number | null;
} {
  const raw = line
    .substring("#EXT-X-CUE-OUT-CONT".length)
    .trim()
    .replace(/^:/, "");
  const attrs = parseTagAttributes(raw);
  const duration = toFiniteNumber(getTagAttribute(attrs, "DURATION"));
  const elapsed =
    toFiniteNumber(getTagAttribute(attrs, "ELAPSEDTIME")) ??
    toFiniteNumber(getTagAttribute(attrs, "ELAPSED"));

  if (duration !== null || elapsed !== null) {
    return { duration, elapsed };
  }

  const slashMatch = raw.match(
    /^\s*([0-9]+(?:\.[0-9]+)?)\s*\/\s*([0-9]+(?:\.[0-9]+)?)/,
  );
  if (slashMatch) {
    return {
      elapsed: toFiniteNumber(slashMatch[1]),
      duration: toFiniteNumber(slashMatch[2]),
    };
  }

  return { duration: null, elapsed: null };
}

function parsePlaylistText(
  text: string,
  options: ParsePlaylistTextOptions = {},
): SkipRange[] {
  const lines = text.split(MANIFEST_LINE_BREAK).map((line) => line.trim());
  if (lines.length === 0) return [];

  let currentTime = options.timelineStart ?? 0;
  let pendingSegmentDuration: number | null = null;
  let programDateTimeAnchorMs: number | null = null;
  let programDateTimeAnchorTimeline: number | null = null;
  let activeCueOutStart: number | null = null;
  let activeCueOutDuration = Number.NaN;
  const ranges: SkipRange[] = [];
  const activeDaterangeStarts = new Map<string, number>();

  const closeCueOut = (end: number) => {
    if (activeCueOutStart === null) return;
    const cueOutEnd =
      Number.isFinite(activeCueOutDuration) && activeCueOutDuration > 0
        ? Math.min(activeCueOutStart + activeCueOutDuration, end)
        : end;
    ranges.push({ start: activeCueOutStart, end: cueOutEnd });
    activeCueOutStart = null;
    activeCueOutDuration = Number.NaN;
  };

  const closeDaterange = (id: string, end: number) => {
    const start = activeDaterangeStarts.get(id);
    if (start === undefined) return;
    ranges.push({ start, end });
    activeDaterangeStarts.delete(id);
  };

  const mapProgramDateTimeToTimeline = (rawDate: string | undefined) => {
    if (
      !rawDate ||
      programDateTimeAnchorMs === null ||
      programDateTimeAnchorTimeline === null
    ) {
      return null;
    }

    const dateMs = Date.parse(rawDate);
    if (!Number.isFinite(dateMs)) return null;

    return (
      programDateTimeAnchorTimeline + (dateMs - programDateTimeAnchorMs) / 1000
    );
  };

  for (const line of lines) {
    if (!line || line.startsWith("#")) {
      if (!line) {
        continue;
      }

      if (line.startsWith("#EXTINF")) {
        const raw = line.replace(/^#EXTINF:/, "");
        const commaIndex = raw.indexOf(",");
        const durationText = commaIndex > -1 ? raw.slice(0, commaIndex) : raw;
        pendingSegmentDuration = toFiniteNumber(durationText);
        continue;
      }

      if (line.startsWith("#EXT-X-PROGRAM-DATE-TIME")) {
        const raw = line.replace(/^#EXT-X-PROGRAM-DATE-TIME:/, "");
        const dateMs = Date.parse(raw);
        if (Number.isFinite(dateMs)) {
          programDateTimeAnchorMs = dateMs;
          programDateTimeAnchorTimeline = currentTime;
        } else {
          programDateTimeAnchorMs = null;
          programDateTimeAnchorTimeline = null;
        }
        continue;
      }

      if (line.startsWith("#EXT-X-DISCONTINUITY")) {
        programDateTimeAnchorMs = null;
        programDateTimeAnchorTimeline = null;
        continue;
      }

      if (line.startsWith("#EXT-X-CUE-OUT-CONT")) {
        const { duration, elapsed } = parseCueOutContTiming(line);
        if (duration !== null && Number.isFinite(duration)) {
          activeCueOutDuration = duration;
        }
        if (elapsed !== null && Number.isFinite(elapsed)) {
          activeCueOutStart = currentTime - elapsed;
        } else if (activeCueOutStart === null) {
          activeCueOutStart = currentTime;
        }
        continue;
      }

      if (line.startsWith("#EXT-X-CUE-OUT")) {
        const duration = parseCueDurationFromLine(line, "#EXT-X-CUE-OUT");
        activeCueOutStart = currentTime;
        activeCueOutDuration = duration ?? Number.NaN;
        continue;
      }

      if (line.startsWith("#EXT-X-CUE-IN")) {
        closeCueOut(currentTime);
        continue;
      }

      if (line.startsWith("#EXT-X-DATERANGE")) {
        const attrs = parseTagAttributes(line.replace(/^#EXT-X-DATERANGE/, ""));
        if (!isAdLikeDaterange(attrs)) {
          continue;
        }

        const duration =
          toFiniteNumber(attrs.DURATION) ??
          toFiniteNumber(attrs["PLANNED-DURATION"]);
        const startDate = attrs["START-DATE"];
        const endDate = attrs["END-DATE"];
        const mappedStart = mapProgramDateTimeToTimeline(startDate);
        const rangeStart = mappedStart ?? currentTime;

        if (duration !== null && Number.isFinite(duration)) {
          ranges.push({
            start: rangeStart,
            end: rangeStart + duration,
          });
          continue;
        }

        if (startDate && endDate) {
          const startMs = Date.parse(startDate);
          const endMs = Date.parse(endDate);
          if (
            Number.isFinite(startMs) &&
            Number.isFinite(endMs) &&
            endMs > startMs
          ) {
            const mappedEnd = mapProgramDateTimeToTimeline(endDate);
            ranges.push({
              start: rangeStart,
              end: mappedEnd ?? rangeStart + (endMs - startMs) / 1000,
            });
            continue;
          }
        }

        const id = attrs.ID;
        if (id) {
          if (activeDaterangeStarts.has(id)) {
            closeDaterange(id, currentTime);
          } else {
            activeDaterangeStarts.set(id, rangeStart);
          }
        } else {
          continue;
        }
      }

      continue;
    }

    if (pendingSegmentDuration !== null) {
      currentTime += pendingSegmentDuration;
      pendingSegmentDuration = null;
    }
  }

  if (activeCueOutStart !== null) {
    ranges.push({ start: activeCueOutStart, end: currentTime });
  }

  activeDaterangeStarts.forEach((_start, id) => {
    closeDaterange(id, currentTime);
  });

  return mergeSkipRanges(ranges);
}

async function fetchManifestText(
  url: string,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Unable to fetch manifest: ${response.status}`);
  }

  return response.text();
}

function findVariantPlaylistUrls(lines: string[], baseUrl: string): string[] {
  const variantUrls: string[] = [];

  for (let index = 0; index < lines.length; index++) {
    if (!lines[index].startsWith("#EXT-X-STREAM-INF")) continue;

    for (
      let candidateIndex = index + 1;
      candidateIndex < lines.length;
      candidateIndex++
    ) {
      const candidate = lines[candidateIndex];
      if (!candidate) continue;

      if (!candidate.startsWith(MANIFEST_TAG_PREFIX)) {
        variantUrls.push(new URL(candidate, baseUrl).toString());
        break;
      }
    }
  }

  return variantUrls;
}

export async function parseAdSkipRangesFromManifest(
  manifestUrl: string,
  options: ParseManifestOptions = {},
): Promise<SkipRange[]> {
  const signal = options.signal;

  const parseWithDepth = async (
    url: string,
    depth: number,
  ): Promise<SkipRange[]> => {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const text = await fetchManifestText(url, signal);
    const lines = text.split(MANIFEST_LINE_BREAK).map((line) => line.trim());
    if (lines.length === 0) return [];

    const variantUrls = findVariantPlaylistUrls(lines, url);

    if (variantUrls.length > 0 && depth > 0) {
      let lastError: unknown;
      let parsedVariant = false;
      const variantRanges: SkipRange[] = [];

      for (const variantUrl of variantUrls) {
        try {
          const ranges = await parseWithDepth(variantUrl, depth - 1);
          parsedVariant = true;
          variantRanges.push(...ranges);
        } catch (err) {
          lastError = err;
        }
      }

      if (!parsedVariant && lastError) {
        throw lastError;
      }

      return mergeSkipRanges(variantRanges);
    }

    return parsePlaylistText(text, {
      timelineStart: options.timelineStart,
    });
  };

  return parseWithDepth(manifestUrl, MAX_PLAYLIST_PARSE_DEPTH);
}

export function parseAdSkipRangesFromPlaylistText(
  text: string,
  options: ParsePlaylistTextOptions = {},
): SkipRange[] {
  return parsePlaylistText(text, options);
}

export type { SkipRange };
