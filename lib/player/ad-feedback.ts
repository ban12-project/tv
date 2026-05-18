import type { ContentKind } from "@/lib/adapters/types";
import type {
  FragmentTimelineSample,
  TimelineMappedRange,
} from "@/lib/player/timeline-mapper";

export interface AdSkipRuntimeEvent {
  at: string;
  name: string;
  details?: Record<string, unknown>;
}

export interface AdSkipDebugSnapshot {
  autoSkip: boolean;
  createdAt: string;
  duration: number | null;
  hlsErrors: AdSkipRuntimeEvent[];
  hlsEvents: AdSkipRuntimeEvent[];
  latestPlaylistTextExcerpt?: string;
  latestPlaylistUrl?: string;
  mappedRange: TimelineMappedRange;
  mappedSkipRanges: TimelineMappedRange[];
  pageUrl: string;
  paused: boolean;
  playbackProfile: ContentKind;
  playbackRate: number;
  rawSkipRanges: { start: number; end: number }[];
  readyState: number;
  seek: {
    from: number;
    to: number;
  };
  timelineSamples: FragmentTimelineSample[];
  userAgent: string;
  video: {
    currentSrc: string;
    height: number;
    src: string;
    width: number;
  };
  videoUrl: string;
}

export interface AdSkipFeedbackContext {
  episodeIndex: number;
  episodeName?: string;
  sourceId: string;
  sourceName: string;
  videoId: string;
  videoTitle: string;
}

export interface AdSkipFeedbackPayload {
  context: AdSkipFeedbackContext;
  note?: string;
  snapshot: AdSkipDebugSnapshot;
}
