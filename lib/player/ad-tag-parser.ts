interface SkipRange {
  start: number;
  end: number;
}

const MAX_PLAYLIST_PARSE_DEPTH = 2;
const MANIFEST_LINE_BREAK = /\r\n|\r|\n/;
const MANIFEST_TAG_PREFIX = "#";
const DEFAULT_RESOLUTION_PROBE_BYTES = 262_144;
const DEFAULT_RESOLUTION_PROBE_WINDOW_SECONDS = 120;
const BASELINE_SAMPLE_LIMIT = 12;
const DISCONTINUITY_PROBE_LIMIT = 40;
const MIN_ANOMALY_SEGMENTS = 2;
const MAX_ANOMALY_SEGMENTS = 12;
const RESOLUTION_PROBE_CACHE_LIMIT = 500;
const RESOLUTION_PROBE_CONCURRENCY = 4;
const RESOLUTION_PROBE_TIMEOUT_MS = 8_000;
const INITIAL_TS_PAYLOAD_BUFFER_BYTES = 64 * 1024;
const H264_HIGH_PROFILES = new Set([
  100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134, 135,
]);
const resolutionProbeCache = new Map<string, VideoResolution | null>();

interface ParseManifestOptions {
  signal?: AbortSignal;
  timelineStart?: number;
  playbackTime?: number;
  enableResolutionProbe?: boolean;
  resolutionProbeByteLength?: number;
}

interface ParsePlaylistTextOptions {
  timelineStart?: number;
  playlistUrl?: string;
  signal?: AbortSignal;
  playbackTime?: number;
  enableResolutionProbe?: boolean;
  resolutionProbeByteLength?: number;
}

interface SegmentTimelineEntry {
  start: number;
  end: number;
  url: string;
  startsAfterDiscontinuity: boolean;
}

interface PlaylistParseResult {
  ranges: SkipRange[];
  segments: SegmentTimelineEntry[];
}

interface VideoResolution {
  width: number;
  height: number;
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

function resolutionKey(resolution: VideoResolution): string {
  return `${resolution.width}x${resolution.height}`;
}

function sameResolution(
  left: VideoResolution | null,
  right: VideoResolution | null,
): boolean {
  return (
    left !== null &&
    right !== null &&
    left.width === right.width &&
    left.height === right.height
  );
}

function getModalResolution(
  resolutions: (VideoResolution | null)[],
): VideoResolution | null {
  const counts = new Map<
    string,
    { resolution: VideoResolution; count: number }
  >();
  for (const resolution of resolutions) {
    if (!resolution) continue;

    const key = resolutionKey(resolution);
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { resolution, count: 1 });
    }
  }

  let best: { resolution: VideoResolution; count: number } | null = null;
  for (const value of counts.values()) {
    if (!best || value.count > best.count) {
      best = value;
    }
  }

  return best?.resolution ?? null;
}

function parseCueDurationFromLine(line: string, prefix: string): number | null {
  const raw = line.substring(prefix.length).trim().replace(/^:/, "");
  const attrs = parseTagAttributes(raw);
  const durationFromAttrs =
    toFiniteNumber(getTagAttribute(attrs, "DURATION")) ??
    toFiniteNumber(getTagAttribute(attrs, "TOTAL-DURATION")) ??
    toFiniteNumber(getTagAttribute(attrs, "TOTAL_DURATION"));
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
  const duration =
    toFiniteNumber(getTagAttribute(attrs, "DURATION")) ??
    toFiniteNumber(getTagAttribute(attrs, "TOTAL-DURATION")) ??
    toFiniteNumber(getTagAttribute(attrs, "TOTAL_DURATION"));
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

class BitReader {
  private bitOffset = 0;

  private readonly bytes: Uint8Array;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
  }

  readBit(): number {
    if (this.bitOffset >= this.bytes.length * 8) {
      throw new Error("Unexpected end of bitstream");
    }

    const byte = this.bytes[this.bitOffset >> 3];
    const bit = (byte >> (7 - (this.bitOffset & 7))) & 1;
    this.bitOffset += 1;
    return bit;
  }

  readBits(length: number): number {
    let value = 0;
    for (let index = 0; index < length; index++) {
      value = (value << 1) | this.readBit();
    }
    return value;
  }

  readUnsignedExpGolomb(): number {
    let zeroCount = 0;
    while (this.readBit() === 0) {
      zeroCount += 1;
    }

    const suffix = zeroCount > 0 ? this.readBits(zeroCount) : 0;
    return 2 ** zeroCount - 1 + suffix;
  }

  readSignedExpGolomb(): number {
    const value = this.readUnsignedExpGolomb();
    const sign = value % 2 === 0 ? -1 : 1;
    return sign * Math.ceil(value / 2);
  }
}

function removeEmulationPreventionBytes(bytes: Uint8Array): Uint8Array {
  const result = new Uint8Array(bytes.length);
  let resultIndex = 0;
  for (let index = 0; index < bytes.length; index++) {
    if (
      index >= 2 &&
      bytes[index] === 0x03 &&
      bytes[index - 1] === 0x00 &&
      bytes[index - 2] === 0x00
    ) {
      continue;
    }
    result[resultIndex] = bytes[index];
    resultIndex += 1;
  }

  return result.subarray(0, resultIndex);
}

function skipScalingList(reader: BitReader, size: number) {
  let lastScale = 8;
  let nextScale = 8;

  for (let index = 0; index < size; index++) {
    if (nextScale !== 0) {
      const deltaScale = reader.readSignedExpGolomb();
      nextScale = (lastScale + deltaScale + 256) % 256;
    }
    lastScale = nextScale === 0 ? lastScale : nextScale;
  }
}

function parseH264SpsResolution(nal: Uint8Array): VideoResolution | null {
  try {
    const data = removeEmulationPreventionBytes(nal.slice(1));
    const reader = new BitReader(data);
    const profileIdc = reader.readBits(8);
    reader.readBits(8);
    reader.readBits(8);
    reader.readUnsignedExpGolomb();

    let chromaFormatIdc = 1;
    if (H264_HIGH_PROFILES.has(profileIdc)) {
      chromaFormatIdc = reader.readUnsignedExpGolomb();
      if (chromaFormatIdc === 3) {
        reader.readBit();
      }
      reader.readUnsignedExpGolomb();
      reader.readUnsignedExpGolomb();
      reader.readBit();
      const seqScalingMatrixPresent = reader.readBit() === 1;
      if (seqScalingMatrixPresent) {
        const scalingListCount = chromaFormatIdc === 3 ? 12 : 8;
        for (let index = 0; index < scalingListCount; index++) {
          if (reader.readBit() === 1) {
            skipScalingList(reader, index < 6 ? 16 : 64);
          }
        }
      }
    }

    reader.readUnsignedExpGolomb();
    const picOrderCntType = reader.readUnsignedExpGolomb();
    if (picOrderCntType === 0) {
      reader.readUnsignedExpGolomb();
    } else if (picOrderCntType === 1) {
      reader.readBit();
      reader.readSignedExpGolomb();
      reader.readSignedExpGolomb();
      const cycleCount = reader.readUnsignedExpGolomb();
      for (let index = 0; index < cycleCount; index++) {
        reader.readSignedExpGolomb();
      }
    }

    reader.readUnsignedExpGolomb();
    reader.readBit();
    const picWidthInMbsMinus1 = reader.readUnsignedExpGolomb();
    const picHeightInMapUnitsMinus1 = reader.readUnsignedExpGolomb();
    const frameMbsOnlyFlag = reader.readBit();
    if (frameMbsOnlyFlag === 0) {
      reader.readBit();
    }
    reader.readBit();

    let frameCropLeftOffset = 0;
    let frameCropRightOffset = 0;
    let frameCropTopOffset = 0;
    let frameCropBottomOffset = 0;
    const frameCroppingFlag = reader.readBit();
    if (frameCroppingFlag === 1) {
      frameCropLeftOffset = reader.readUnsignedExpGolomb();
      frameCropRightOffset = reader.readUnsignedExpGolomb();
      frameCropTopOffset = reader.readUnsignedExpGolomb();
      frameCropBottomOffset = reader.readUnsignedExpGolomb();
    }

    const width = (picWidthInMbsMinus1 + 1) * 16;
    const height =
      (2 - frameMbsOnlyFlag) * (picHeightInMapUnitsMinus1 + 1) * 16;
    let cropUnitX = 1;
    let cropUnitY = 2 - frameMbsOnlyFlag;
    if (chromaFormatIdc === 1) {
      cropUnitX = 2;
      cropUnitY = 2 * (2 - frameMbsOnlyFlag);
    } else if (chromaFormatIdc === 2) {
      cropUnitX = 2;
      cropUnitY = 2 - frameMbsOnlyFlag;
    }

    return {
      width: width - (frameCropLeftOffset + frameCropRightOffset) * cropUnitX,
      height: height - (frameCropTopOffset + frameCropBottomOffset) * cropUnitY,
    };
  } catch {
    return null;
  }
}

function getNalStartCodeLength(
  bytes: Uint8Array,
  index: number,
): number | null {
  if (
    index < bytes.length - 2 &&
    bytes[index] === 0x00 &&
    bytes[index + 1] === 0x00 &&
    bytes[index + 2] === 0x01
  ) {
    return 3;
  }

  if (
    index < bytes.length - 3 &&
    bytes[index] === 0x00 &&
    bytes[index + 1] === 0x00 &&
    bytes[index + 2] === 0x00 &&
    bytes[index + 3] === 0x01
  ) {
    return 4;
  }

  return null;
}

function parseNalResolution(
  bytes: Uint8Array,
  nalStart: number,
  nalEnd: number,
): VideoResolution | null {
  if (nalStart >= nalEnd) return null;

  const nalType = bytes[nalStart] & 0x1f;
  if (nalType !== 7) return null;

  return parseH264SpsResolution(bytes.slice(nalStart, nalEnd));
}

function findH264SpsResolution(bytes: Uint8Array): VideoResolution | null {
  let pendingNalStart: number | null = null;

  for (let index = 0; index < bytes.length - 2; index++) {
    const startCodeLength = getNalStartCodeLength(bytes, index);
    if (startCodeLength === null) continue;

    if (pendingNalStart !== null) {
      const resolution = parseNalResolution(bytes, pendingNalStart, index);
      if (resolution) return resolution;
    }

    pendingNalStart = index + startCodeLength;
    index += startCodeLength - 1;
  }

  if (pendingNalStart !== null) {
    const resolution = parseNalResolution(bytes, pendingNalStart, bytes.length);
    if (resolution) return resolution;
  }

  return null;
}
function getTsPacketPayloadOffset(
  bytes: Uint8Array,
  packetOffset: number,
): number | null {
  const packetSize = 188;
  const adaptationFieldControl = (bytes[packetOffset + 3] >> 4) & 0x03;
  if (adaptationFieldControl !== 1 && adaptationFieldControl !== 3) return null;

  let payloadOffset = packetOffset + 4;
  if (adaptationFieldControl === 3) {
    payloadOffset += 1 + bytes[payloadOffset];
  }
  if (payloadOffset >= packetOffset + packetSize) return null;

  return payloadOffset;
}

function getTsPacketPid(bytes: Uint8Array, packetOffset: number): number {
  return ((bytes[packetOffset + 1] & 0x1f) << 8) | bytes[packetOffset + 2];
}

function readPsiSection(
  bytes: Uint8Array,
  packetOffset: number,
): Uint8Array | null {
  const payloadOffset = getTsPacketPayloadOffset(bytes, packetOffset);
  if (payloadOffset === null) return null;

  const payloadUnitStartIndicator = (bytes[packetOffset + 1] & 0x40) !== 0;
  const sectionOffset = payloadUnitStartIndicator
    ? payloadOffset + 1 + bytes[payloadOffset]
    : payloadOffset;
  if (sectionOffset + 3 > packetOffset + 188) return null;

  const sectionLength =
    ((bytes[sectionOffset + 1] & 0x0f) << 8) | bytes[sectionOffset + 2];
  const sectionEnd = sectionOffset + 3 + sectionLength;
  if (sectionEnd > packetOffset + 188) return null;

  return bytes.slice(sectionOffset, sectionEnd);
}

function parsePatPmtPid(section: Uint8Array): number | null {
  if (section[0] !== 0x00 || section.length < 12) return null;

  const sectionLength = ((section[1] & 0x0f) << 8) | section[2];
  const entriesEnd = Math.min(section.length, 3 + sectionLength - 4);
  for (let offset = 8; offset + 4 <= entriesEnd; offset += 4) {
    const programNumber = (section[offset] << 8) | section[offset + 1];
    if (programNumber === 0) continue;

    return ((section[offset + 2] & 0x1f) << 8) | section[offset + 3];
  }

  return null;
}

function parsePmtVideoPid(section: Uint8Array): number | null {
  if (section[0] !== 0x02 || section.length < 16) return null;

  const sectionLength = ((section[1] & 0x0f) << 8) | section[2];
  const programInfoLength = ((section[10] & 0x0f) << 8) | section[11];
  let offset = 12 + programInfoLength;
  const entriesEnd = Math.min(section.length, 3 + sectionLength - 4);

  while (offset + 5 <= entriesEnd) {
    const streamType = section[offset];
    const elementaryPid =
      ((section[offset + 1] & 0x1f) << 8) | section[offset + 2];
    const esInfoLength =
      ((section[offset + 3] & 0x0f) << 8) | section[offset + 4];
    if (streamType === 0x1b) {
      return elementaryPid;
    }
    offset += 5 + esInfoLength;
  }

  return null;
}

function findH264VideoPid(bytes: Uint8Array): number | null {
  const packetSize = 188;
  let pmtPid: number | null = null;

  for (
    let offset = 0;
    offset + packetSize <= bytes.length;
    offset += packetSize
  ) {
    if (bytes[offset] !== 0x47) continue;

    const pid = getTsPacketPid(bytes, offset);
    const section = readPsiSection(bytes, offset);
    if (!section) continue;

    if (pid === 0x0000) {
      pmtPid = parsePatPmtPid(section);
    } else if (pmtPid !== null && pid === pmtPid) {
      return parsePmtVideoPid(section);
    }
  }

  return null;
}

function extractTsPayload(bytes: Uint8Array): Uint8Array {
  let payload = new Uint8Array(
    Math.max(1, Math.min(bytes.length, INITIAL_TS_PAYLOAD_BUFFER_BYTES)),
  );
  let payloadIndex = 0;
  const packetSize = 188;
  const videoPid = findH264VideoPid(bytes);

  const appendPayload = (chunk: Uint8Array) => {
    const requiredLength = payloadIndex + chunk.length;
    if (requiredLength > payload.length) {
      let nextLength = payload.length;
      while (nextLength < requiredLength) {
        nextLength *= 2;
      }
      const nextPayload = new Uint8Array(Math.min(nextLength, bytes.length));
      nextPayload.set(payload);
      payload = nextPayload;
    }
    payload.set(chunk, payloadIndex);
    payloadIndex += chunk.length;
  };

  for (
    let offset = 0;
    offset + packetSize <= bytes.length;
    offset += packetSize
  ) {
    if (bytes[offset] !== 0x47) continue;
    if (videoPid !== null && getTsPacketPid(bytes, offset) !== videoPid) {
      continue;
    }

    let payloadOffset = getTsPacketPayloadOffset(bytes, offset);
    if (payloadOffset === null) continue;

    const payloadUnitStartIndicator = (bytes[offset + 1] & 0x40) !== 0;
    if (
      payloadUnitStartIndicator &&
      payloadOffset + 9 < offset + packetSize &&
      bytes[payloadOffset] === 0x00 &&
      bytes[payloadOffset + 1] === 0x00 &&
      bytes[payloadOffset + 2] === 0x01
    ) {
      payloadOffset += 9 + bytes[payloadOffset + 8];
    }
    if (payloadOffset >= offset + packetSize) continue;

    const chunk = bytes.subarray(payloadOffset, offset + packetSize);
    appendPayload(chunk);
  }

  return payload.subarray(0, payloadIndex);
}

function createTimeoutSignal(parentSignal: AbortSignal | undefined): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(parentSignal?.reason);
  if (parentSignal?.aborted) {
    abortFromParent();
  } else {
    parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  }

  const timeout = setTimeout(() => {
    controller.abort();
  }, RESOLUTION_PROBE_TIMEOUT_MS);

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeout);
      parentSignal?.removeEventListener("abort", abortFromParent);
    },
  };
}

async function probeSegmentResolution(
  url: string,
  options: {
    signal?: AbortSignal;
    byteLength: number;
    cache: Map<string, VideoResolution | null>;
  },
): Promise<VideoResolution | null> {
  if (options.cache.has(url)) {
    const cached = options.cache.get(url) ?? null;
    options.cache.delete(url);
    options.cache.set(url, cached);
    return cached;
  }

  const timeoutSignal = createTimeoutSignal(options.signal);
  try {
    const response = await fetch(url, {
      headers: {
        Range: `bytes=0-${Math.max(0, options.byteLength - 1)}`,
      },
      signal: timeoutSignal.signal,
    });

    if (!response.ok) {
      options.cache.set(url, null);
      return null;
    }

    if (response.status !== 206) {
      await response.body?.cancel();
      options.cache.set(url, null);
      return null;
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    const payload = extractTsPayload(bytes);
    const resolution = findH264SpsResolution(payload);
    options.cache.set(url, resolution);
    if (options.cache.size > RESOLUTION_PROBE_CACHE_LIMIT) {
      const firstKey = options.cache.keys().next().value;
      if (firstKey) {
        options.cache.delete(firstKey);
      }
    }
    return resolution;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      if (!options.signal?.aborted) {
        options.cache.set(url, null);
        return null;
      }
      throw err;
    }
    options.cache.set(url, null);
    return null;
  } finally {
    timeoutSignal.cleanup();
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, limit), items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(items[currentIndex]);
      }
    }),
  );

  return results;
}

function parsePlaylistText(
  text: string,
  options: ParsePlaylistTextOptions = {},
): PlaylistParseResult {
  const lines = text.split(MANIFEST_LINE_BREAK).map((line) => line.trim());
  if (lines.length === 0) return { ranges: [], segments: [] };

  let currentTime = options.timelineStart ?? 0;
  let pendingSegmentDuration: number | null = null;
  let programDateTimeAnchorMs: number | null = null;
  let programDateTimeAnchorTimeline: number | null = null;
  let activeCueOutStart: number | null = null;
  let activeCueOutDuration = Number.NaN;
  let pendingDiscontinuity = false;
  const ranges: SkipRange[] = [];
  const segments: SegmentTimelineEntry[] = [];
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
        pendingDiscontinuity = true;
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
        closeCueOut(currentTime);
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
      const start = currentTime;
      currentTime += pendingSegmentDuration;
      if (options.playlistUrl) {
        segments.push({
          start,
          end: currentTime,
          url: new URL(line, options.playlistUrl).toString(),
          startsAfterDiscontinuity: pendingDiscontinuity,
        });
      }
      pendingSegmentDuration = null;
      pendingDiscontinuity = false;
    }
  }

  closeCueOut(currentTime);

  activeDaterangeStarts.forEach((_start, id) => {
    closeDaterange(id, currentTime);
  });

  return {
    ranges: mergeSkipRanges(ranges),
    segments,
  };
}

async function inferResolutionSkipRanges(
  segments: SegmentTimelineEntry[],
  options: ParsePlaylistTextOptions,
): Promise<SkipRange[]> {
  if (!options.enableResolutionProbe || segments.length === 0) return [];

  const signal = options.signal;
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  const byteLength =
    options.resolutionProbeByteLength ?? DEFAULT_RESOLUTION_PROBE_BYTES;
  const playbackTime = Math.max(0, options.playbackTime ?? 0);
  const probeEndTime = playbackTime + DEFAULT_RESOLUTION_PROBE_WINDOW_SECONDS;
  const probe = (segment: SegmentTimelineEntry) =>
    probeSegmentResolution(segment.url, {
      signal,
      byteLength,
      cache: resolutionProbeCache,
    });

  const previousSegments = segments
    .filter((segment) => segment.end <= playbackTime)
    .slice(-BASELINE_SAMPLE_LIMIT);
  if (previousSegments.length < MIN_ANOMALY_SEGMENTS) {
    return [];
  }

  const baseline = getModalResolution(
    await mapWithConcurrency(
      previousSegments,
      RESOLUTION_PROBE_CONCURRENCY,
      probe,
    ),
  );
  if (!baseline) return [];

  const ranges: SkipRange[] = [];
  let checkedDiscontinuities = 0;

  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index];
    if (!segment.startsAfterDiscontinuity) continue;
    if (segment.start > probeEndTime) continue;

    const candidateEnd =
      segments[Math.min(segments.length, index + MAX_ANOMALY_SEGMENTS) - 1].end;
    if (candidateEnd <= playbackTime) continue;

    checkedDiscontinuities += 1;
    if (checkedDiscontinuities > DISCONTINUITY_PROBE_LIMIT) break;

    const candidateSegments = segments.slice(
      index,
      Math.min(segments.length, index + MAX_ANOMALY_SEGMENTS),
    );
    const candidateResolutions = await mapWithConcurrency(
      candidateSegments,
      RESOLUTION_PROBE_CONCURRENCY,
      probe,
    );
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const anomalySegments: SegmentTimelineEntry[] = [];
    for (
      let probeIndex = 0;
      probeIndex < candidateSegments.length;
      probeIndex++
    ) {
      const currentSegment = candidateSegments[probeIndex];
      const resolution = candidateResolutions[probeIndex];
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      if (!resolution) {
        break;
      }
      if (sameResolution(resolution, baseline)) {
        break;
      }

      anomalySegments.push(currentSegment);
    }

    if (anomalySegments.length >= MIN_ANOMALY_SEGMENTS) {
      const first = anomalySegments[0];
      const last = anomalySegments[anomalySegments.length - 1];
      ranges.push({ start: first.start, end: last.end });
      index += anomalySegments.length - 1;
    }
  }

  return mergeSkipRanges(ranges);
}

async function buildSkipRangesFromPlaylistText(
  text: string,
  options: ParsePlaylistTextOptions = {},
): Promise<SkipRange[]> {
  const result = parsePlaylistText(text, options);
  const resolutionRanges = await inferResolutionSkipRanges(
    result.segments,
    options,
  );

  return mergeSkipRanges([...result.ranges, ...resolutionRanges]);
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

function resolveManifestUrl(url: string): string {
  try {
    return new URL(url).toString();
  } catch (err) {
    if (typeof window !== "undefined") {
      return new URL(url, window.location.href).toString();
    }

    throw err;
  }
}

function findVariantPlaylistUrls(lines: string[], baseUrl: string): string[] {
  const variantUrls: string[] = [];
  const resolvedBaseUrl = resolveManifestUrl(baseUrl);

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
        variantUrls.push(new URL(candidate, resolvedBaseUrl).toString());
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
      for (const variantUrl of variantUrls) {
        try {
          return await parseWithDepth(variantUrl, depth - 1);
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            throw err;
          }
          lastError = err;
        }
      }

      if (lastError) {
        throw lastError;
      }

      return [];
    }

    return buildSkipRangesFromPlaylistText(text, {
      timelineStart: options.timelineStart,
      playlistUrl: url,
      signal,
      playbackTime: options.playbackTime,
      enableResolutionProbe: options.enableResolutionProbe,
      resolutionProbeByteLength: options.resolutionProbeByteLength,
    });
  };

  return parseWithDepth(
    resolveManifestUrl(manifestUrl),
    MAX_PLAYLIST_PARSE_DEPTH,
  );
}

export function parseAdSkipRangesFromPlaylistText(
  text: string,
  options: ParsePlaylistTextOptions = {},
): SkipRange[] {
  return parsePlaylistText(text, options).ranges;
}

export async function parseAdSkipRangesFromPlaylistTextWithSideChannel(
  text: string,
  options: ParsePlaylistTextOptions = {},
): Promise<SkipRange[]> {
  return buildSkipRangesFromPlaylistText(text, options);
}

export type { SkipRange };
