interface SkipRange {
  start: number;
  end: number;
}

const MAX_PLAYLIST_PARSE_DEPTH = 2;
const MANIFEST_LINE_BREAK = /\r\n|\r|\n/;
const MANIFEST_TAG_PREFIX = "#";
const DEFAULT_MEDIA_FINGERPRINT_PROBE_BYTES = 262_144;
const DEFAULT_MEDIA_FINGERPRINT_PROBE_WINDOW_SECONDS = 120;
const BASELINE_SAMPLE_LIMIT = 12;
const DISCONTINUITY_PROBE_LIMIT = 40;
const MIN_ANOMALY_SEGMENTS = 2;
const MAX_ANOMALY_SEGMENTS = 12;
const MEDIA_FINGERPRINT_PROBE_CACHE_LIMIT = 500;
const MEDIA_FINGERPRINT_PROBE_CONCURRENCY = 4;
const MEDIA_FINGERPRINT_PROBE_TIMEOUT_MS = 8_000;
const INITIAL_TS_PAYLOAD_BUFFER_BYTES = 64 * 1024;
const BITRATE_ANOMALY_RATIO = 0.35;
const MIN_STRONG_ANOMALY_SECONDS = 1.5;
const DEFAULT_RESOLUTION_PROBE_BYTES = DEFAULT_MEDIA_FINGERPRINT_PROBE_BYTES;
const H264_HIGH_PROFILES = new Set([
  100, 110, 122, 244, 44, 83, 86, 118, 128, 138, 139, 134, 135,
]);
const mediaFingerprintProbeCache = new Map<string, SegmentFingerprint | null>();
const ADTS_SAMPLE_RATES = [
  96_000, 88_200, 64_000, 48_000, 44_100, 32_000, 24_000, 22_050, 16_000,
  12_000, 11_025, 8_000, 7_350,
];

interface ParseManifestOptions {
  signal?: AbortSignal;
  timelineStart?: number;
  playbackTime?: number;
  enableMediaFingerprintProbe?: boolean;
  mediaFingerprintProbeByteLength?: number;
  enableResolutionProbe?: boolean;
  resolutionProbeByteLength?: number;
}

interface ParsePlaylistTextOptions {
  timelineStart?: number;
  playlistUrl?: string;
  signal?: AbortSignal;
  playbackTime?: number;
  enableMediaFingerprintProbe?: boolean;
  mediaFingerprintProbeByteLength?: number;
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

interface H264CodecInfo extends VideoResolution {
  profileIdc: number;
  constraintFlags: number;
  levelIdc: number;
  spsHash: string;
  ppsHash: string | null;
}

interface AacAudioInfo {
  profile: number;
  sampleRate: number;
  channelConfig: number;
}

interface TsStreamInfo {
  pid: number;
  streamType: number;
}

interface TsProgramInfo {
  programNumber: number | null;
  pmtPid: number | null;
  pcrPid: number | null;
  videoPid: number | null;
  audioPid: number | null;
  streams: TsStreamInfo[];
}

interface SegmentFingerprint {
  resolution: VideoResolution | null;
  h264CodecKey: string | null;
  spsHash: string | null;
  ppsHash: string | null;
  audioKey: string | null;
  programLayoutKey: string | null;
  bitrateKbps: number | null;
  urlFamilyKey: string;
}

interface FingerprintBaseline {
  resolution: VideoResolution | null;
  h264CodecKey: string | null;
  spsHash: string | null;
  ppsHash: string | null;
  audioKey: string | null;
  programLayoutKey: string | null;
  bitrateKbps: number | null;
  urlFamilyKey: string | null;
}

interface SegmentAnomalyEvidence {
  strong: number;
  weak: number;
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

function getModalValue<T>(values: (T | null)[]): T | null {
  const counts = new Map<string, { value: T; count: number }>();
  for (const value of values) {
    if (value === null) continue;

    const key = String(value);
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { value, count: 1 });
    }
  }

  let best: { value: T; count: number } | null = null;
  for (const count of counts.values()) {
    if (!best || count.count > best.count) {
      best = count;
    }
  }

  return best?.value ?? null;
}

function getMedianNumber(values: (number | null)[]): number | null {
  const sorted = values
    .filter(
      (value): value is number => value !== null && Number.isFinite(value),
    )
    .toSorted((a, b) => a - b);
  if (sorted.length === 0) return null;

  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function hashBytes(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash.toString(16).padStart(8, "0");
}

function getUrlFamilyKey(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    parts.pop();
    return `${parsed.host}/${parts.join("/")}`;
  } catch {
    const [path] = url.split(/[?#]/, 1);
    const slashIndex = path.lastIndexOf("/");
    return slashIndex > -1 ? path.slice(0, slashIndex) : path;
  }
}

function getContentRangeTotalBytes(contentRange: string | null): number | null {
  if (!contentRange) return null;

  const match = contentRange.match(/\/(\d+)$/);
  if (!match) return null;

  const total = Number.parseInt(match[1], 10);
  return Number.isFinite(total) && total > 0 ? total : null;
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

function parseH264SpsInfo(nal: Uint8Array): H264CodecInfo | null {
  try {
    const data = removeEmulationPreventionBytes(nal.slice(1));
    const reader = new BitReader(data);
    const profileIdc = reader.readBits(8);
    const constraintFlags = reader.readBits(8);
    const levelIdc = reader.readBits(8);
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

    const parsedWidth =
      width - (frameCropLeftOffset + frameCropRightOffset) * cropUnitX;
    const parsedHeight =
      height - (frameCropTopOffset + frameCropBottomOffset) * cropUnitY;

    return {
      width: parsedWidth,
      height: parsedHeight,
      profileIdc,
      constraintFlags,
      levelIdc,
      spsHash: hashBytes(nal),
      ppsHash: null,
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

function parseNalInfo(
  bytes: Uint8Array,
  nalStart: number,
  nalEnd: number,
): {
  h264: H264CodecInfo | null;
  ppsHash: string | null;
} | null {
  if (nalStart >= nalEnd) return null;

  const nalType = bytes[nalStart] & 0x1f;
  if (nalType === 7) {
    return {
      h264: parseH264SpsInfo(bytes.slice(nalStart, nalEnd)),
      ppsHash: null,
    };
  }
  if (nalType === 8) {
    return {
      h264: null,
      ppsHash: hashBytes(bytes.slice(nalStart, nalEnd)),
    };
  }

  return {
    h264: null,
    ppsHash: null,
  };
}

function findH264CodecInfo(bytes: Uint8Array): H264CodecInfo | null {
  let pendingNalStart: number | null = null;
  let h264: H264CodecInfo | null = null;
  let ppsHash: string | null = null;

  const applyNal = (nalStart: number, nalEnd: number) => {
    const parsed = parseNalInfo(bytes, nalStart, nalEnd);
    if (!parsed) {
      return {
        h264: null,
        ppsHash: null,
      };
    }

    return parsed;
  };

  for (let index = 0; index < bytes.length - 2; index++) {
    const startCodeLength = getNalStartCodeLength(bytes, index);
    if (startCodeLength === null) continue;

    if (pendingNalStart !== null) {
      const parsed = applyNal(pendingNalStart, index);
      h264 ??= parsed.h264;
      ppsHash ??= parsed.ppsHash;
      if (h264 && ppsHash) break;
    }

    pendingNalStart = index + startCodeLength;
    index += startCodeLength - 1;
  }

  if (pendingNalStart !== null && (!h264 || !ppsHash)) {
    const parsed = applyNal(pendingNalStart, bytes.length);
    h264 ??= parsed.h264;
    ppsHash ??= parsed.ppsHash;
  }

  const parsedH264 = h264;
  if (parsedH264 === null) return null;

  return { ...parsedH264, ppsHash };
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

function parsePatProgram(section: Uint8Array): {
  programNumber: number;
  pmtPid: number;
} | null {
  if (section[0] !== 0x00 || section.length < 12) return null;

  const sectionLength = ((section[1] & 0x0f) << 8) | section[2];
  const entriesEnd = Math.min(section.length, 3 + sectionLength - 4);
  for (let offset = 8; offset + 4 <= entriesEnd; offset += 4) {
    const programNumber = (section[offset] << 8) | section[offset + 1];
    if (programNumber === 0) continue;

    return {
      programNumber,
      pmtPid: ((section[offset + 2] & 0x1f) << 8) | section[offset + 3],
    };
  }

  return null;
}

function parsePmtInfo(
  section: Uint8Array,
): Pick<TsProgramInfo, "audioPid" | "pcrPid" | "streams" | "videoPid"> | null {
  if (section[0] !== 0x02 || section.length < 16) return null;

  const sectionLength = ((section[1] & 0x0f) << 8) | section[2];
  const pcrPid = ((section[8] & 0x1f) << 8) | section[9];
  const programInfoLength = ((section[10] & 0x0f) << 8) | section[11];
  let offset = 12 + programInfoLength;
  const entriesEnd = Math.min(section.length, 3 + sectionLength - 4);
  let videoPid: number | null = null;
  let audioPid: number | null = null;
  const streams: TsStreamInfo[] = [];

  while (offset + 5 <= entriesEnd) {
    const streamType = section[offset];
    const elementaryPid =
      ((section[offset + 1] & 0x1f) << 8) | section[offset + 2];
    const esInfoLength =
      ((section[offset + 3] & 0x0f) << 8) | section[offset + 4];
    streams.push({ pid: elementaryPid, streamType });
    if (videoPid === null && streamType === 0x1b) {
      videoPid = elementaryPid;
    } else if (audioPid === null && streamType === 0x0f) {
      audioPid = elementaryPid;
    }
    offset += 5 + esInfoLength;
  }

  return { audioPid, pcrPid, streams, videoPid };
}

function findTsProgramInfo(bytes: Uint8Array): TsProgramInfo {
  const packetSize = 188;
  let pmtPid: number | null = null;
  let programNumber: number | null = null;

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
      const program = parsePatProgram(section);
      if (program) {
        programNumber = program.programNumber;
        pmtPid = program.pmtPid;
      }
    } else if (pmtPid !== null && pid === pmtPid) {
      const pmt = parsePmtInfo(section);
      if (pmt) {
        return { programNumber, pmtPid, ...pmt };
      }
    }
  }

  return {
    audioPid: null,
    pcrPid: null,
    programNumber,
    pmtPid,
    streams: [],
    videoPid: null,
  };
}

function getProgramLayoutKey(program: TsProgramInfo): string | null {
  if (program.streams.length === 0) return null;

  const streams = program.streams
    .map((stream) => `${stream.streamType.toString(16)}@${stream.pid}`)
    .join(",");
  return [
    `program=${program.programNumber ?? "?"}`,
    `pmt=${program.pmtPid ?? "?"}`,
    `pcr=${program.pcrPid ?? "?"}`,
    streams,
  ].join("|");
}

function extractTsPayload(bytes: Uint8Array, pid: number | null): Uint8Array {
  let payload = new Uint8Array(
    Math.max(1, Math.min(bytes.length, INITIAL_TS_PAYLOAD_BUFFER_BYTES)),
  );
  let payloadIndex = 0;
  const packetSize = 188;

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
    if (pid !== null && getTsPacketPid(bytes, offset) !== pid) {
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

function findAacAudioInfo(bytes: Uint8Array): AacAudioInfo | null {
  for (let index = 0; index + 7 <= bytes.length; index++) {
    if (bytes[index] !== 0xff || (bytes[index + 1] & 0xf0) !== 0xf0) {
      continue;
    }

    const sampleRateIndex = (bytes[index + 2] & 0x3c) >> 2;
    const sampleRate = ADTS_SAMPLE_RATES[sampleRateIndex];
    if (!sampleRate) continue;

    return {
      profile: ((bytes[index + 2] & 0xc0) >> 6) + 1,
      sampleRate,
      channelConfig:
        ((bytes[index + 2] & 0x01) << 2) | ((bytes[index + 3] & 0xc0) >> 6),
    };
  }

  return null;
}

function getH264CodecKey(h264: H264CodecInfo | null): string | null {
  if (!h264) return null;

  return [
    h264.width,
    h264.height,
    h264.profileIdc,
    h264.constraintFlags,
    h264.levelIdc,
  ].join("x");
}

function getAacAudioKey(audio: AacAudioInfo | null): string | null {
  if (!audio) return null;

  return [audio.profile, audio.sampleRate, audio.channelConfig].join("x");
}

function buildSegmentFingerprint(
  bytes: Uint8Array,
  options: {
    duration: number;
    totalBytes: number | null;
    url: string;
  },
): SegmentFingerprint | null {
  const program = findTsProgramInfo(bytes);
  const videoPayload =
    program.videoPid !== null
      ? extractTsPayload(bytes, program.videoPid)
      : null;
  const audioPayload =
    program.audioPid !== null
      ? extractTsPayload(bytes, program.audioPid)
      : null;
  const h264 = videoPayload ? findH264CodecInfo(videoPayload) : null;
  const audio = audioPayload ? findAacAudioInfo(audioPayload) : null;
  const duration = Math.max(0, options.duration);
  const bitrateKbps =
    options.totalBytes !== null && duration > 0
      ? (options.totalBytes * 8) / duration / 1000
      : null;

  if (!h264 && !audio && program.streams.length === 0 && bitrateKbps === null) {
    return null;
  }

  return {
    resolution: h264 ? { width: h264.width, height: h264.height } : null,
    h264CodecKey: getH264CodecKey(h264),
    spsHash: h264?.spsHash ?? null,
    ppsHash: h264?.ppsHash ?? null,
    audioKey: getAacAudioKey(audio),
    programLayoutKey: getProgramLayoutKey(program),
    bitrateKbps,
    urlFamilyKey: getUrlFamilyKey(options.url),
  };
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
  }, MEDIA_FINGERPRINT_PROBE_TIMEOUT_MS);

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeout);
      parentSignal?.removeEventListener("abort", abortFromParent);
    },
  };
}

async function probeSegmentFingerprint(
  segment: SegmentTimelineEntry,
  options: {
    signal?: AbortSignal;
    byteLength: number;
    cache: Map<string, SegmentFingerprint | null>;
  },
): Promise<SegmentFingerprint | null> {
  if (options.cache.has(segment.url)) {
    const cached = options.cache.get(segment.url) ?? null;
    options.cache.delete(segment.url);
    options.cache.set(segment.url, cached);
    return cached;
  }

  const timeoutSignal = createTimeoutSignal(options.signal);
  try {
    const response = await fetch(segment.url, {
      headers: {
        Range: `bytes=0-${Math.max(0, options.byteLength - 1)}`,
      },
      signal: timeoutSignal.signal,
    });

    if (!response.ok) {
      options.cache.set(segment.url, null);
      return null;
    }

    if (response.status !== 206) {
      await response.body?.cancel();
      options.cache.set(segment.url, null);
      return null;
    }

    const totalBytes = getContentRangeTotalBytes(
      response.headers.get("Content-Range"),
    );
    const bytes = new Uint8Array(await response.arrayBuffer());
    const fingerprint = buildSegmentFingerprint(bytes, {
      duration: segment.end - segment.start,
      totalBytes,
      url: segment.url,
    });
    options.cache.set(segment.url, fingerprint);
    if (options.cache.size > MEDIA_FINGERPRINT_PROBE_CACHE_LIMIT) {
      const firstKey = options.cache.keys().next().value;
      if (firstKey) {
        options.cache.delete(firstKey);
      }
    }
    return fingerprint;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      if (!options.signal?.aborted) {
        options.cache.set(segment.url, null);
        return null;
      }
      throw err;
    }
    options.cache.set(segment.url, null);
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

function isMediaFingerprintProbeEnabled(
  options: ParsePlaylistTextOptions,
): boolean {
  return (
    options.enableMediaFingerprintProbe ??
    options.enableResolutionProbe ??
    false
  );
}

function getMediaFingerprintProbeByteLength(
  options: ParsePlaylistTextOptions,
): number {
  return (
    options.mediaFingerprintProbeByteLength ??
    options.resolutionProbeByteLength ??
    DEFAULT_RESOLUTION_PROBE_BYTES
  );
}

function buildFingerprintBaseline(
  fingerprints: (SegmentFingerprint | null)[],
): FingerprintBaseline | null {
  const usable = fingerprints.filter(
    (fingerprint): fingerprint is SegmentFingerprint => fingerprint !== null,
  );
  if (usable.length < MIN_ANOMALY_SEGMENTS) return null;

  return {
    resolution: getModalResolution(
      usable.map((fingerprint) => fingerprint.resolution),
    ),
    h264CodecKey: getModalValue(
      usable.map((fingerprint) => fingerprint.h264CodecKey),
    ),
    spsHash: getModalValue(usable.map((fingerprint) => fingerprint.spsHash)),
    ppsHash: getModalValue(usable.map((fingerprint) => fingerprint.ppsHash)),
    audioKey: getModalValue(usable.map((fingerprint) => fingerprint.audioKey)),
    programLayoutKey: getModalValue(
      usable.map((fingerprint) => fingerprint.programLayoutKey),
    ),
    bitrateKbps: getMedianNumber(
      usable.map((fingerprint) => fingerprint.bitrateKbps),
    ),
    urlFamilyKey: getModalValue(
      usable.map((fingerprint) => fingerprint.urlFamilyKey),
    ),
  };
}

function compareNullableValue(
  left: string | null,
  right: string | null,
): boolean {
  return left !== null && right !== null && left !== right;
}

function getSegmentAnomalyEvidence(
  fingerprint: SegmentFingerprint | null,
  baseline: FingerprintBaseline,
): SegmentAnomalyEvidence {
  if (!fingerprint) return { strong: 0, weak: 0 };

  let strong = 0;
  let weak = 0;
  if (!sameResolution(fingerprint.resolution, baseline.resolution)) {
    if (fingerprint.resolution && baseline.resolution) {
      strong += 1;
    }
  }
  if (compareNullableValue(fingerprint.h264CodecKey, baseline.h264CodecKey)) {
    strong += 1;
  }
  if (compareNullableValue(fingerprint.spsHash, baseline.spsHash)) {
    strong += 1;
  }
  if (compareNullableValue(fingerprint.ppsHash, baseline.ppsHash)) {
    strong += 1;
  }
  if (compareNullableValue(fingerprint.audioKey, baseline.audioKey)) {
    strong += 1;
  }
  if (
    compareNullableValue(
      fingerprint.programLayoutKey,
      baseline.programLayoutKey,
    )
  ) {
    strong += 1;
  }
  if (
    fingerprint.bitrateKbps !== null &&
    baseline.bitrateKbps !== null &&
    baseline.bitrateKbps > 0 &&
    Math.abs(fingerprint.bitrateKbps - baseline.bitrateKbps) /
      baseline.bitrateKbps >=
      BITRATE_ANOMALY_RATIO
  ) {
    weak += 1;
  }
  if (compareNullableValue(fingerprint.urlFamilyKey, baseline.urlFamilyKey)) {
    weak += 1;
  }

  return { strong, weak };
}

function isAnomalousSegment(
  segment: SegmentTimelineEntry,
  evidence: SegmentAnomalyEvidence,
): boolean {
  const duration = segment.end - segment.start;
  return (
    (evidence.strong > 0 && duration >= MIN_STRONG_ANOMALY_SECONDS) ||
    evidence.strong > 1 ||
    evidence.weak >= 2
  );
}

function findDiscontinuityCandidateIndex(
  segments: SegmentTimelineEntry[],
  index: number,
): number | null {
  for (let current = index; current >= 0; current--) {
    if (segments[current].startsAfterDiscontinuity) {
      return current;
    }

    if (index - current >= MAX_ANOMALY_SEGMENTS) break;
  }

  return null;
}

async function inferMediaFingerprintSkipRanges(
  segments: SegmentTimelineEntry[],
  options: ParsePlaylistTextOptions,
): Promise<SkipRange[]> {
  if (!isMediaFingerprintProbeEnabled(options) || segments.length === 0) {
    return [];
  }

  const signal = options.signal;
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  const byteLength = getMediaFingerprintProbeByteLength(options);
  const playbackTime = Math.max(0, options.playbackTime ?? 0);
  const probeEndTime =
    playbackTime + DEFAULT_MEDIA_FINGERPRINT_PROBE_WINDOW_SECONDS;
  const probe = (segment: SegmentTimelineEntry) =>
    probeSegmentFingerprint(segment, {
      signal,
      byteLength,
      cache: mediaFingerprintProbeCache,
    });

  const previousSegments = segments
    .filter((segment) => segment.end <= playbackTime)
    .slice(-BASELINE_SAMPLE_LIMIT);
  if (previousSegments.length < MIN_ANOMALY_SEGMENTS) {
    return [];
  }

  const baseline = buildFingerprintBaseline(
    await mapWithConcurrency(
      previousSegments,
      MEDIA_FINGERPRINT_PROBE_CONCURRENCY,
      probe,
    ),
  );
  if (!baseline) return [];

  const ranges: SkipRange[] = [];
  let checkedDiscontinuities = 0;
  const checkedStartIndexes = new Set<number>();

  for (let index = 0; index < segments.length; index++) {
    const candidateStartIndex = segments[index].startsAfterDiscontinuity
      ? index
      : segments[index].start <= playbackTime &&
          segments[index].end > playbackTime
        ? findDiscontinuityCandidateIndex(segments, index)
        : null;
    if (candidateStartIndex === null) continue;
    if (checkedStartIndexes.has(candidateStartIndex)) continue;
    checkedStartIndexes.add(candidateStartIndex);

    const segment = segments[candidateStartIndex];
    if (segment.start > probeEndTime) continue;

    const candidateEnd =
      segments[
        Math.min(segments.length, candidateStartIndex + MAX_ANOMALY_SEGMENTS) -
          1
      ].end;
    if (candidateEnd <= playbackTime) continue;

    checkedDiscontinuities += 1;
    if (checkedDiscontinuities > DISCONTINUITY_PROBE_LIMIT) break;

    const candidateSegments = segments.slice(
      candidateStartIndex,
      Math.min(segments.length, candidateStartIndex + MAX_ANOMALY_SEGMENTS),
    );
    const candidateFingerprints = await mapWithConcurrency(
      candidateSegments,
      MEDIA_FINGERPRINT_PROBE_CONCURRENCY,
      probe,
    );
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const anomalySegments: SegmentTimelineEntry[] = [];
    let hasStrongAnomaly = false;
    for (
      let probeIndex = 0;
      probeIndex < candidateSegments.length;
      probeIndex++
    ) {
      const currentSegment = candidateSegments[probeIndex];
      const fingerprint = candidateFingerprints[probeIndex];
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const evidence = getSegmentAnomalyEvidence(fingerprint, baseline);
      if (!isAnomalousSegment(currentSegment, evidence)) {
        break;
      }

      hasStrongAnomaly ||= evidence.strong > 0;
      anomalySegments.push(currentSegment);
    }

    const anomalyDuration =
      anomalySegments.at(-1)?.end && anomalySegments[0]
        ? anomalySegments[anomalySegments.length - 1].end -
          anomalySegments[0].start
        : 0;
    if (
      anomalySegments.length >= MIN_ANOMALY_SEGMENTS ||
      (hasStrongAnomaly && anomalyDuration >= MIN_STRONG_ANOMALY_SECONDS)
    ) {
      const first = anomalySegments[0];
      const last = anomalySegments[anomalySegments.length - 1];
      ranges.push({ start: first.start, end: last.end });
      index = Math.max(index, candidateStartIndex + anomalySegments.length - 1);
    }
  }

  return mergeSkipRanges(ranges);
}

async function buildSkipRangesFromPlaylistText(
  text: string,
  options: ParsePlaylistTextOptions = {},
): Promise<SkipRange[]> {
  const result = parsePlaylistText(text, options);
  const mediaFingerprintRanges = await inferMediaFingerprintSkipRanges(
    result.segments,
    options,
  );

  return mergeSkipRanges([...result.ranges, ...mediaFingerprintRanges]);
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
      enableMediaFingerprintProbe: options.enableMediaFingerprintProbe,
      mediaFingerprintProbeByteLength: options.mediaFingerprintProbeByteLength,
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
