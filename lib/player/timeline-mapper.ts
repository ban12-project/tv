const TIMELINE_SAMPLE_LIMIT = 10_000;
const TIMELINE_BOUNDARY_EPSILON_SECONDS = 0.05;
const TIMELINE_BOUNDARY_CONVERGENCE_SECONDS = 0.25;

export interface HlsFragmentLike {
  cc?: number;
  duration?: number;
  end?: number;
  endPTS?: number;
  level?: number;
  minEndPTS?: number;
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
  const parts: string[] = [];
  if (isFiniteNumber(frag.level)) parts.push(`level=${frag.level}`);
  if (isFiniteNumber(frag.cc)) parts.push(`cc=${frag.cc}`);
  if (frag.sn !== undefined && frag.sn !== null) parts.push(`sn=${frag.sn}`);

  const url = frag.url ?? frag.relurl;
  const stableUrl = url?.split(/[?#]/, 1)[0];
  if (stableUrl) parts.push(`url=${stableUrl}`);

  if (parts.length === 0) {
    if (isFiniteNumber(frag.start)) parts.push(`start=${frag.start}`);
    if (isFiniteNumber(frag.duration)) parts.push(`duration=${frag.duration}`);
  }

  return parts.join(":");
}

export function upsertFragmentTimelineSample(
  samples: Map<string, FragmentTimelineSample>,
  sample: FragmentTimelineSample,
): TimelineSampleUpsertResult {
  const unchanged = { changed: false, indexChanged: false };
  if (sample.playlistEnd <= sample.playlistStart) return unchanged;

  const existing = samples.get(sample.key);
  const wasIndexed =
    isFiniteNumber(existing?.mediaStart) && isFiniteNumber(existing?.mediaEnd);
  const preserveOriginalPlaylistBounds =
    wasIndexed &&
    existing !== undefined &&
    sample.mediaStart === undefined &&
    sample.mediaEnd === undefined;
  const playlistStart = preserveOriginalPlaylistBounds
    ? existing.playlistStart
    : sample.playlistStart;
  const playlistEnd = preserveOriginalPlaylistBounds
    ? existing.playlistEnd
    : sample.playlistEnd;
  const mediaStart = sample.mediaStart ?? existing?.mediaStart;
  const mediaEnd = sample.mediaEnd ?? existing?.mediaEnd;
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

export function getPlaylistBoundsFromFragment(frag: HlsFragmentLike) {
  const playlistStart = isFiniteNumber(frag.start) ? frag.start : null;
  const duration = isFiniteNumber(frag.duration) ? frag.duration : null;
  if (playlistStart === null || duration === null || duration <= 0) {
    return null;
  }

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

function interpolateSampleMediaTime(
  sample: FragmentTimelineSample,
  time: number,
): number | null {
  if (!isFiniteNumber(sample.mediaStart) || !isFiniteNumber(sample.mediaEnd)) {
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

function findMatchingSamplesForPlaylistTime(
  samples: TimelineSampleIndex,
  time: number,
): FragmentTimelineSample[] {
  if (samples.length === 0) return [];

  let low = 0;
  let high = samples.length - 1;
  let pivot = 0;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const sample = samples[middle];
    if (time < sample.playlistStart) {
      high = middle - 1;
      pivot = middle;
    } else if (time > sample.playlistEnd) {
      low = middle + 1;
      pivot = low;
    } else {
      pivot = middle;
      break;
    }
  }

  const matches: FragmentTimelineSample[] = [];
  const startIdx = Math.max(0, pivot - 2);
  const endIdx = Math.min(samples.length - 1, pivot + 2);
  for (let index = startIdx; index <= endIdx; index++) {
    const sample = samples[index];
    if (
      time >= sample.playlistStart - TIMELINE_BOUNDARY_EPSILON_SECONDS &&
      time <= sample.playlistEnd + TIMELINE_BOUNDARY_EPSILON_SECONDS
    ) {
      matches.push(sample);
    }
  }

  return matches;
}

function mapPlaylistTimeToMediaTime(
  samples: TimelineSampleIndex,
  time: number,
  role: "start" | "end",
): number | null {
  const matches = findMatchingSamplesForPlaylistTime(samples, time);
  if (matches.length === 0) return null;

  let endingCandidate: number | null = null;
  let startingCandidate: number | null = null;
  let interiorCandidate: number | null = null;

  for (const sample of matches) {
    const mapped = interpolateSampleMediaTime(sample, time);
    if (mapped === null) continue;

    const distToEnd = Math.abs(time - sample.playlistEnd);
    const distToStart = Math.abs(time - sample.playlistStart);
    if (
      distToEnd <= TIMELINE_BOUNDARY_EPSILON_SECONDS &&
      distToEnd < distToStart
    ) {
      endingCandidate =
        endingCandidate === null ? mapped : Math.max(endingCandidate, mapped);
    } else if (
      distToStart <= TIMELINE_BOUNDARY_EPSILON_SECONDS &&
      distToStart <= distToEnd
    ) {
      startingCandidate =
        startingCandidate === null
          ? mapped
          : Math.min(startingCandidate, mapped);
    } else {
      interiorCandidate = mapped;
    }
  }

  if (endingCandidate !== null && startingCandidate !== null) {
    if (
      Math.abs(startingCandidate - endingCandidate) <=
      TIMELINE_BOUNDARY_CONVERGENCE_SECONDS
    ) {
      return role === "end"
        ? Math.max(endingCandidate, startingCandidate)
        : Math.min(endingCandidate, startingCandidate);
    }
    return role === "start" ? startingCandidate : endingCandidate;
  }

  if (role === "start") {
    return startingCandidate ?? interiorCandidate ?? endingCandidate;
  }
  return endingCandidate ?? startingCandidate ?? interiorCandidate;
}

function mapSkipRangeToMediaTime(
  samples: TimelineSampleIndex,
  range: { start: number; end: number },
): TimelineMappedRange {
  const rawDuration = range.end - range.start;
  if (rawDuration <= 0) {
    return { ...range, calibrated: false };
  }

  let mappedStart = mapPlaylistTimeToMediaTime(samples, range.start, "start");
  let mappedEnd = mapPlaylistTimeToMediaTime(samples, range.end, "end");

  if (mappedStart !== null && mappedEnd === null) {
    // When the start of the ad is buffered/calibrated but its end is further ahead,
    // use the latest calibrated sample inside the ad range (or mappedStart) to
    // extrapolate the PTS drift so we neither skip late nor land short.
    let anchorPlaylistTime = range.start;
    let anchorMediaTime = mappedStart;
    for (const sample of samples) {
      if (
        sample.playlistEnd > anchorPlaylistTime &&
        sample.playlistEnd <= range.end + TIMELINE_BOUNDARY_EPSILON_SECONDS &&
        isFiniteNumber(sample.mediaEnd)
      ) {
        anchorPlaylistTime = sample.playlistEnd;
        anchorMediaTime = sample.mediaEnd;
      }
    }
    mappedEnd = anchorMediaTime + Math.max(0, range.end - anchorPlaylistTime);
  } else if (mappedStart === null && mappedEnd !== null) {
    let anchorPlaylistTime = range.end;
    let anchorMediaTime = mappedEnd;
    for (const sample of samples) {
      if (
        sample.playlistStart >=
          range.start - TIMELINE_BOUNDARY_EPSILON_SECONDS &&
        sample.playlistStart < anchorPlaylistTime &&
        isFiniteNumber(sample.mediaStart)
      ) {
        anchorPlaylistTime = sample.playlistStart;
        anchorMediaTime = sample.mediaStart;
        break;
      }
    }
    mappedStart = Math.max(
      0,
      anchorMediaTime - Math.max(0, anchorPlaylistTime - range.start),
    );
  }

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
