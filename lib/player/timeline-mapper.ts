const TIMELINE_SAMPLE_LIMIT = 2_000;
const TIMELINE_BOUNDARY_EPSILON_SECONDS = 0.025;

export interface HlsFragmentLike {
  cc?: number;
  duration?: number;
  end?: number;
  endPTS?: number;
  level?: number;
  minEndPTS?: number;
  playlistOffset?: number;
  relurl?: string;
  sn?: number | string;
  start?: number;
  startPTS?: number;
  url?: string;
}

export interface FragmentTimelineSample {
  key: string;
  cc: number;
  playlistStart: number;
  playlistEnd: number;
  mediaStart?: number;
  mediaEnd?: number;
}

export interface TimelineMappedRange {
  start: number;
  end: number;
  calibrated: boolean;
}

export type TimelineSampleIndex = FragmentTimelineSample[];

interface TimelineSampleUpsertResult {
  changed: boolean;
  indexChanged: boolean;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function getFragmentTimelineKey(frag: HlsFragmentLike) {
  const url = frag.url ?? frag.relurl ?? "url";
  const stableUrl = url.split(/[?#]/, 1)[0];
  return [
    isFiniteNumber(frag.level) ? frag.level : "level",
    isFiniteNumber(frag.cc) ? frag.cc : "cc",
    frag.sn ?? "sn",
    stableUrl,
  ].join(":");
}

export function upsertFragmentTimelineSample(
  samples: Map<string, FragmentTimelineSample>,
  sample: FragmentTimelineSample,
): TimelineSampleUpsertResult {
  const unchanged = { changed: false, indexChanged: false };
  if (sample.playlistEnd <= sample.playlistStart) return unchanged;

  const existing = samples.get(sample.key);
  const playlistStart = existing?.playlistStart ?? sample.playlistStart;
  const playlistEnd = existing?.playlistEnd ?? sample.playlistEnd;
  const mediaStart = sample.mediaStart ?? existing?.mediaStart;
  const mediaEnd = sample.mediaEnd ?? existing?.mediaEnd;
  const wasIndexed =
    isFiniteNumber(existing?.mediaStart) && isFiniteNumber(existing?.mediaEnd);
  const willBeIndexed = isFiniteNumber(mediaStart) && isFiniteNumber(mediaEnd);

  if (
    existing &&
    existing.playlistStart === playlistStart &&
    existing.playlistEnd === playlistEnd &&
    existing.mediaStart === mediaStart &&
    existing.mediaEnd === mediaEnd
  ) {
    samples.delete(sample.key);
    samples.set(sample.key, existing);
    return unchanged;
  }

  if (existing) {
    samples.delete(sample.key);
  }

  samples.set(sample.key, {
    ...sample,
    playlistStart,
    playlistEnd,
    mediaStart,
    mediaEnd,
  });

  return {
    changed: true,
    indexChanged:
      !existing ||
      playlistStart !== existing.playlistStart ||
      playlistEnd !== existing.playlistEnd ||
      wasIndexed !== willBeIndexed,
  };
}

export function cleanupTimelineSamples(
  samples: Map<string, FragmentTimelineSample>,
) {
  let changed = false;
  while (samples.size > TIMELINE_SAMPLE_LIMIT) {
    const oldestKey = samples.keys().next().value;
    if (oldestKey === undefined) break;
    samples.delete(oldestKey);
    changed = true;
  }

  return changed;
}

export function getPlaylistBoundsFromFragment(
  frag: HlsFragmentLike,
  playlistTimelineStart: number,
) {
  const playlistOffset = isFiniteNumber(frag.playlistOffset)
    ? frag.playlistOffset
    : isFiniteNumber(frag.start)
      ? frag.start - playlistTimelineStart
      : null;
  const duration = isFiniteNumber(frag.duration) ? frag.duration : null;
  if (playlistOffset === null || duration === null || duration <= 0) {
    return null;
  }

  const playlistStart = playlistTimelineStart + playlistOffset;
  return {
    playlistStart,
    playlistEnd: playlistStart + duration,
  };
}

export function getMediaBoundsFromFragment(frag: HlsFragmentLike) {
  const mediaStart = isFiniteNumber(frag.start) ? frag.start : null;
  const mediaEnd = isFiniteNumber(frag.end) ? frag.end : null;

  if (mediaStart === null || mediaEnd === null || mediaEnd <= mediaStart) {
    return null;
  }

  return { mediaStart, mediaEnd };
}

export function buildTimelineSampleIndex(
  samples: Map<string, FragmentTimelineSample>,
): TimelineSampleIndex {
  return Array.from(samples.values())
    .filter(
      (sample) =>
        isFiniteNumber(sample.mediaStart) && isFiniteNumber(sample.mediaEnd),
    )
    .sort((left, right) => left.playlistStart - right.playlistStart);
}

function getBoundaryDistance(sample: FragmentTimelineSample, time: number) {
  return Math.min(
    Math.abs(time - sample.playlistStart),
    Math.abs(time - sample.playlistEnd),
  );
}

function findTimelineSampleForPlaylistTime(
  samples: TimelineSampleIndex,
  time: number,
) {
  let low = 0;
  let high = samples.length - 1;
  let insertionIndex = 0;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const sample = samples[middle];
    if (time < sample.playlistStart) {
      high = middle - 1;
      insertionIndex = middle;
    } else if (time > sample.playlistEnd) {
      low = middle + 1;
      insertionIndex = low;
    } else {
      return sample;
    }
  }

  let nearest: FragmentTimelineSample | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const sample of [samples[insertionIndex - 1], samples[insertionIndex]]) {
    if (!sample) continue;

    const distance = getBoundaryDistance(sample, time);
    if (distance < nearestDistance) {
      nearest = sample;
      nearestDistance = distance;
    }
  }

  return nearestDistance <= TIMELINE_BOUNDARY_EPSILON_SECONDS ? nearest : null;
}

function mapPlaylistTimeToMediaTime(
  samples: TimelineSampleIndex,
  time: number,
) {
  const sample = findTimelineSampleForPlaylistTime(samples, time);
  if (
    !sample ||
    !isFiniteNumber(sample.mediaStart) ||
    !isFiniteNumber(sample.mediaEnd)
  ) {
    return null;
  }

  const playlistDuration = sample.playlistEnd - sample.playlistStart;
  const mediaDuration = sample.mediaEnd - sample.mediaStart;
  if (playlistDuration <= 0 || mediaDuration <= 0) return null;

  const ratio = Math.min(
    1,
    Math.max(0, (time - sample.playlistStart) / playlistDuration),
  );
  return sample.mediaStart + ratio * mediaDuration;
}

function mapSkipRangeToMediaTime(
  samples: TimelineSampleIndex,
  range: { start: number; end: number },
): TimelineMappedRange {
  const mappedStart = mapPlaylistTimeToMediaTime(samples, range.start);
  const mappedEnd = mapPlaylistTimeToMediaTime(samples, range.end);
  if (mappedStart === null || mappedEnd === null || mappedEnd <= mappedStart) {
    return { ...range, calibrated: false };
  }

  return {
    start: mappedStart,
    end: mappedEnd,
    calibrated: true,
  };
}

export function mapSkipRangesToMediaTime(
  samples: TimelineSampleIndex,
  ranges: { start: number; end: number }[],
) {
  return ranges.map((range) => mapSkipRangeToMediaTime(samples, range));
}
