import type { ContentKind, ContentProfile, Video } from "@/lib/adapters/types";

const STRONG_SHORT_DRAMA_PATTERNS = [
  /短剧/u,
  /微短剧/u,
  /爽剧/u,
  /竖屏/u,
  /竖版/u,
  /短视频剧/u,
  /小剧场/u,
  /抖音/u,
  /快手/u,
  /番茄/u,
  /mini\s*drama/i,
  /short\s*drama/i,
  /micro\s*drama/i,
  /vertical\s*drama/i,
];

const SUPPORTING_SHORT_FORM_PATTERNS = [
  /更新至\s*\d+/u,
  /\d+\s*集全/u,
  /全集/u,
  /合集/u,
  /短篇/u,
  /mini/i,
  /short/i,
  /micro/i,
];

const SHORT_DRAMA_CONFIDENCE_THRESHOLD = 60;

export interface InferContentProfileOptions {
  aspectRatio?: string | null;
  width?: number;
  height?: number;
}

function clampConfidence(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function isPortraitAspectRatio(value?: string | null) {
  if (!value) return false;

  const [rawWidth, rawHeight] = value
    .split("/")
    .map((part) => Number.parseFloat(part.trim()));

  if (!Number.isFinite(rawWidth) || !Number.isFinite(rawHeight)) return false;
  if (rawWidth <= 0 || rawHeight <= 0) return false;

  return rawWidth / rawHeight < 0.85;
}

export function isPortraitDimensions(width?: number, height?: number) {
  if (!width || !height) return false;
  return width > 0 && height > 0 && width / height < 0.85;
}

export function getPlaybackKind(profile?: ContentProfile | null): ContentKind {
  return profile?.kind === "short-drama" ? "short-drama" : "standard";
}

export function inferContentProfile(
  video: Pick<
    Video,
    | "title"
    | "genre"
    | "description"
    | "episodes"
    | "remarks"
    | "blurb"
    | "contentKind"
    | "contentSignals"
    | "contentConfidence"
  >,
  options: InferContentProfileOptions = {},
): ContentProfile {
  const signals = new Set<string>(video.contentSignals ?? []);
  let score = video.contentKind === "short-drama" ? 65 : 0;

  if (video.contentConfidence) {
    score = Math.max(score, video.contentConfidence);
  }

  const searchableText = [
    video.title,
    video.description,
    video.remarks,
    video.blurb,
    ...(video.genre ?? []),
  ]
    .filter(Boolean)
    .join(" ");

  if (
    STRONG_SHORT_DRAMA_PATTERNS.some((pattern) => pattern.test(searchableText))
  ) {
    score += 70;
    signals.add("keyword");
  }

  const episodeCount = video.episodes?.length ?? 0;
  const hasSupportingShortFormText = SUPPORTING_SHORT_FORM_PATTERNS.some(
    (pattern) => pattern.test(searchableText),
  );

  if (episodeCount >= 20 && hasSupportingShortFormText) {
    score += 35;
    signals.add("episode-count-with-short-form-copy");
  } else if (episodeCount >= 60) {
    score += 20;
    signals.add("large-episode-count");
  }

  const isPortrait =
    isPortraitAspectRatio(options.aspectRatio) ||
    isPortraitDimensions(options.width, options.height);

  if (isPortrait) {
    score += 80;
    signals.add("portrait-video");
  }

  const confidence = clampConfidence(score);
  const kind: ContentKind =
    confidence >= SHORT_DRAMA_CONFIDENCE_THRESHOLD ? "short-drama" : "standard";

  return {
    kind,
    confidence,
    signals: Array.from(signals).sort(),
    aspectRatio: options.aspectRatio ?? undefined,
  };
}

export function mergeContentProfiles(
  base: ContentProfile | null | undefined,
  next: ContentProfile,
): ContentProfile {
  if (!base || next.confidence >= base.confidence) {
    return next;
  }

  return {
    ...base,
    signals: Array.from(new Set([...base.signals, ...next.signals])).sort(),
    aspectRatio: next.aspectRatio ?? base.aspectRatio,
  };
}
