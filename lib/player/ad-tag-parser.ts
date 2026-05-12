interface SkipRange {
  start: number;
  end: number;
}

const MAX_PLAYLIST_PARSE_DEPTH = 2;
const MANIFEST_LINE_BREAK = /\r\n|\r|\n/;
const MANIFEST_TAG_PREFIX = "#";

interface ParseManifestOptions {
  signal?: AbortSignal;
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

  const regex = /([A-Za-z0-9-]+)=("([^"]*)"|'([^']*)'|[^,]*)/g;
  for (const match of attributeText.matchAll(regex)) {
    const key = match[1];
    const rawValue = match[3] ?? match[4] ?? match[2];
    const normalized = rawValue.replace(/^["']/, "").replace(/["']$/, "");
    result[key] = normalized;
  }

  return result;
}

function isAdLikeDaterange(attributes: Record<string, string>): boolean {
  const classValue = attributes.CLASS ?? "";
  const normalizedClass = classValue.toLowerCase();
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
    adKeywords.some((keyword) => normalizedClass.includes(keyword)) ||
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
    const last = merged.at(-1);
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

function parseCueDurationFromLine(
  line: string,
  prefix: string,
): number | null {
  const raw = line.substring(prefix.length).trim().replace(/^:/, "");
  const attrs = parseTagAttributes(raw);
  const durationFromAttrs = toFiniteNumber(attrs.DURATION);
  if (durationFromAttrs !== null) return durationFromAttrs;

  const match = raw.match(/^[\s]*([0-9]+(?:\.[0-9]+)?)/);
  if (match && !raw.includes("/")) {
    return match ? toFiniteNumber(match[1]) : null;
  }

  if (raw.includes("/")) {
    const lastSegment = raw.trim().split("/").at(-1);
    return toFiniteNumber(lastSegment);
  }

  return match ? toFiniteNumber(match[1]) : null;
}

function parsePlaylistText(text: string): SkipRange[] {
  const lines = text.split(MANIFEST_LINE_BREAK).map((line) => line.trim());
  if (lines.length === 0) return [];

  let currentTime = 0;
  let pendingSegmentDuration: number | null = null;
  let activeCueOutStart: number | null = null;
  let activeCueOutDuration = Number.NaN;
  const ranges: SkipRange[] = [];
  const activeDaterangeStarts = new Map<string, number>();

  const closeCueOut = (end: number) => {
    if (activeCueOutStart === null) return;
    const cueOutEnd =
      Number.isFinite(activeCueOutDuration) && activeCueOutDuration > 0
        ? activeCueOutStart + activeCueOutDuration
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

      if (line.startsWith("#EXT-X-CUE-OUT")) {
        const duration = parseCueDurationFromLine(line, "#EXT-X-CUE-OUT");
        activeCueOutStart = currentTime;
        activeCueOutDuration = duration ?? Number.NaN;
        continue;
      }

      if (line.startsWith("#EXT-X-CUE-OUT-CONT")) {
        const duration = parseCueDurationFromLine(line, "#EXT-X-CUE-OUT-CONT");
        if (Number.isFinite(duration)) {
          activeCueOutDuration = duration;
          if (activeCueOutStart === null) {
            activeCueOutStart = currentTime;
          }
        }
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

        const duration = toFiniteNumber(attrs.DURATION);
        const startDate = attrs["START-DATE"];
        const endDate = attrs["END-DATE"];

        if (Number.isFinite(duration)) {
          ranges.push({
            start: currentTime,
            end: currentTime + duration,
          });
          continue;
        }

        if (startDate && endDate) {
          const startMs = Date.parse(startDate);
          const endMs = Date.parse(endDate);
          if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
            ranges.push({
              start: currentTime,
              end: currentTime + (endMs - startMs) / 1000,
            });
            continue;
          }
        }

        const id = attrs.ID;
        if (id) {
          if (activeDaterangeStarts.has(id)) {
            closeDaterange(id, currentTime);
          } else {
            activeDaterangeStarts.set(id, currentTime);
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

  activeDaterangeStarts.forEach((start, id) => {
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

    const streamInfIndexes = lines
      .map((line, index) => (line.startsWith("#EXT-X-STREAM-INF") ? index : -1))
      .filter((value) => value >= 0);

    for (const index of streamInfIndexes) {
      let nextLine: string | undefined;
      for (let i = index + 1; i < lines.length; i++) {
        const candidate = lines[i];
        if (candidate && !candidate.startsWith(MANIFEST_TAG_PREFIX)) {
          nextLine = candidate;
          break;
        }
      }

      if (nextLine) {
        const variantUrl = new URL(nextLine, url).toString();
        if (depth > 0) {
          return parseWithDepth(variantUrl, depth - 1);
        }
        break;
      }
    }

    return parsePlaylistText(text);
  };

  return parseWithDepth(manifestUrl, MAX_PLAYLIST_PARSE_DEPTH);
}

export type { SkipRange };
