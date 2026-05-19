import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRegisteredUser, UnauthorizedError } from "@/lib/auth-utils";

const GITHUB_REQUEST_TIMEOUT_MS = 15_000;
const ISSUE_BODY_LIMIT = 60_000;
const ISSUE_TITLE_LIMIT = 256;
const ISSUE_VIDEO_TITLE_LIMIT = 150;
const DEBUG_DEFAULT_STRING_LIMIT = 1000;
const DEBUG_PLAYLIST_TEXT_LIMIT = 12_000;
const DEBUG_MAX_OBJECT_KEYS = 30;
const DEBUG_MAX_DEPTH = 6;
const CONTEXT_NAME_LIMIT = 200;
const CONTEXT_ID_LIMIT = 500;
const SNAPSHOT_URL_LIMIT = 2000;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;

const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
let rateLimitSql: ReturnType<typeof neon> | null = null;

const finiteNumber = z.number().finite();
const nullableFiniteNumber = finiteNumber.nullable();

const rangeSchema = z.object({
  calibrated: z.boolean().optional(),
  end: finiteNumber,
  start: finiteNumber,
});

const runtimeEventSchema = z.object({
  at: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  name: z.string(),
});

const timelineSampleSchema = z.object({
  cc: finiteNumber,
  key: z.string(),
  mediaEnd: finiteNumber.optional(),
  mediaStart: finiteNumber.optional(),
  playlistEnd: finiteNumber,
  playlistStart: finiteNumber,
});

const issueSchema = z.object({
  html_url: z.string().url(),
  number: z.number().int(),
});

const payloadSchema = z.object({
  context: z.object({
    episodeIndex: z.number().int().nonnegative(),
    episodeName: z.string().max(CONTEXT_NAME_LIMIT).optional(),
    sourceId: z.string().min(1).max(CONTEXT_ID_LIMIT),
    sourceName: z.string().min(1).max(CONTEXT_NAME_LIMIT),
    videoId: z.string().min(1).max(CONTEXT_ID_LIMIT),
    videoTitle: z.string().min(1).max(CONTEXT_NAME_LIMIT),
  }),
  note: z.string().max(4000).optional(),
  snapshot: z
    .object({
      autoSkip: z.boolean(),
      createdAt: z.string(),
      duration: nullableFiniteNumber,
      hlsErrors: z.array(runtimeEventSchema).max(50),
      hlsEvents: z.array(runtimeEventSchema).max(50),
      latestPlaylistTextExcerpt: z.string().max(20_000).optional(),
      latestPlaylistUrl: z.string().max(SNAPSHOT_URL_LIMIT).optional(),
      mappedRange: rangeSchema,
      mappedSkipRanges: z.array(rangeSchema).max(100),
      pageUrl: z.string().max(SNAPSHOT_URL_LIMIT),
      paused: z.boolean(),
      playbackProfile: z.enum(["standard", "short-drama"]),
      playbackRate: finiteNumber,
      rawSkipRanges: z
        .array(z.object({ end: finiteNumber, start: finiteNumber }))
        .max(100),
      readyState: z.number().int(),
      seek: z.object({
        from: finiteNumber,
        to: finiteNumber,
      }),
      timelineSamples: z.array(timelineSampleSchema).max(200),
      userAgent: z.string().max(1000),
      video: z.object({
        currentSrc: z.string().max(SNAPSHOT_URL_LIMIT),
        height: z.number().int().nonnegative(),
        src: z.string().max(SNAPSHOT_URL_LIMIT),
        width: z.number().int().nonnegative(),
      }),
      videoUrl: z.string().max(SNAPSHOT_URL_LIMIT),
    })
    .strict(),
});

function truncateJsonString(value: string, limit = DEBUG_DEFAULT_STRING_LIMIT) {
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 3))}...`;
}

function redactUrl(value: string) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "[redacted-url]";
  }
}

function sanitizeJsonValue(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return truncateJsonString(value);
  if (typeof value !== "object" || value === null) return value;
  if (depth >= DEBUG_MAX_DEPTH) return "[max-depth]";

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonValue(item, depth + 1));
  }

  const allEntries = Object.entries(value);
  const entries = allEntries.slice(0, DEBUG_MAX_OBJECT_KEYS);
  const sanitized = Object.fromEntries(
    entries.map(([key, item]) => [key, sanitizeJsonValue(item, depth + 1)]),
  );

  if (allEntries.length > DEBUG_MAX_OBJECT_KEYS) {
    sanitized.__truncatedKeys = allEntries.length - DEBUG_MAX_OBJECT_KEYS;
  }

  return sanitized;
}

function sanitizeDebugPayload(payload: z.infer<typeof payloadSchema>) {
  return {
    ...payload,
    note: payload.note ? truncateJsonString(payload.note) : undefined,
    snapshot: {
      ...payload.snapshot,
      hlsErrors: sanitizeJsonValue(payload.snapshot.hlsErrors),
      hlsEvents: sanitizeJsonValue(payload.snapshot.hlsEvents),
      latestPlaylistTextExcerpt: payload.snapshot.latestPlaylistTextExcerpt
        ? truncateJsonString(
            payload.snapshot.latestPlaylistTextExcerpt,
            DEBUG_PLAYLIST_TEXT_LIMIT,
          )
        : undefined,
      latestPlaylistUrl: payload.snapshot.latestPlaylistUrl
        ? redactUrl(payload.snapshot.latestPlaylistUrl)
        : undefined,
      pageUrl: redactUrl(payload.snapshot.pageUrl),
      timelineSamples: sanitizeJsonValue(payload.snapshot.timelineSamples),
      userAgent: "[redacted]",
      video: {
        ...payload.snapshot.video,
        currentSrc: redactUrl(payload.snapshot.video.currentSrc),
        src: redactUrl(payload.snapshot.video.src),
      },
      videoUrl: redactUrl(payload.snapshot.videoUrl),
    },
  };
}

function formatDebugJson(payload: z.infer<typeof payloadSchema>) {
  const sanitizedPayload = sanitizeDebugPayload(payload);
  const json = JSON.stringify(sanitizedPayload, null, 2);

  if (json.length <= ISSUE_BODY_LIMIT) return json;

  return JSON.stringify(
    {
      context: sanitizedPayload.context,
      note: sanitizedPayload.note,
      snapshot: {
        ...sanitizedPayload.snapshot,
        hlsErrors: "[truncated]",
        hlsEvents: "[truncated]",
        latestPlaylistTextExcerpt: "[truncated]",
        timelineSamples: "[truncated]",
      },
      warning: "Debug payload was compacted to keep the GitHub issue valid.",
    },
    null,
    2,
  );
}

function truncateSingleLine(value: string, limit: number) {
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 3))}...`;
}

function sanitizeSingleLine(value: string) {
  return Array.from(value)
    .map((char) => {
      const code = char.charCodeAt(0);
      return code <= 31 || code === 127 ? " " : char;
    })
    .join("")
    .trim();
}

function buildIssueTitle(payload: z.infer<typeof payloadSchema>) {
  const episode = payload.context.episodeIndex + 1;
  const videoTitle = truncateSingleLine(
    payload.context.videoTitle,
    ISSUE_VIDEO_TITLE_LIMIT,
  );

  return truncateSingleLine(
    sanitizeSingleLine(
      `[AD Feedback] ${videoTitle} ep ${episode} ${payload.snapshot.createdAt}`,
    ),
    ISSUE_TITLE_LIMIT,
  );
}

function buildIssueBody(payload: z.infer<typeof payloadSchema>) {
  const { context, note, snapshot } = payload;
  const summary = [
    "## Summary",
    "",
    `- Video: ${context.videoTitle} (${context.videoId})`,
    `- Source: ${context.sourceName} (${context.sourceId})`,
    `- Episode: ${context.episodeIndex + 1}${context.episodeName ? ` - ${context.episodeName}` : ""}`,
    `- Skip: ${snapshot.seek.from.toFixed(3)}s -> ${snapshot.seek.to.toFixed(3)}s`,
    `- Mapped range: ${snapshot.mappedRange.start.toFixed(3)}s - ${snapshot.mappedRange.end.toFixed(3)}s${snapshot.mappedRange.calibrated ? " (calibrated)" : ""}`,
    `- Page: ${redactUrl(snapshot.pageUrl)}`,
    "- Reporter: registered user (redacted)",
  ];

  if (note?.trim()) {
    summary.push("", "## User Note", "", note.trim());
  }

  summary.push(
    "",
    "## Debug Payload",
    "",
    "```json",
    formatDebugJson(payload),
    "```",
  );

  return summary.join("\n");
}

function checkRateLimit(key: string) {
  const now = Date.now();
  for (const [bucketKey, bucket] of rateLimitBuckets) {
    if (bucket.resetAt <= now) {
      rateLimitBuckets.delete(bucketKey);
    }
  }

  const current = rateLimitBuckets.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return true;
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  current.count += 1;
  return true;
}

function getRateLimitSql() {
  if (!process.env.DATABASE_URL) return null;
  rateLimitSql ??= neon(process.env.DATABASE_URL);
  return rateLimitSql;
}

async function checkPersistentRateLimit(key: string) {
  const client = getRateLimitSql();
  if (!client) return checkRateLimit(key);

  const resetAt = new Date(Date.now() + RATE_LIMIT_WINDOW_MS);

  try {
    await client`
      delete from ad_feedback_rate_limit
      where reset_at <= now()
    `;

    const rows = await client`
      insert into ad_feedback_rate_limit (rate_limit_key, count, reset_at, updated_at)
      values (${key}, 1, ${resetAt}, now())
      on conflict (rate_limit_key) do update set
        count = case
          when ad_feedback_rate_limit.reset_at <= now() then 1
          else ad_feedback_rate_limit.count + 1
        end,
        reset_at = case
          when ad_feedback_rate_limit.reset_at <= now() then ${resetAt}
          else ad_feedback_rate_limit.reset_at
        end,
        updated_at = now()
      where ad_feedback_rate_limit.reset_at <= now()
        or ad_feedback_rate_limit.count < ${RATE_LIMIT_MAX_REQUESTS}
      returning count
    `;

    return Array.isArray(rows) && rows.length > 0;
  } catch (error) {
    console.error("[api/ad-feedback] Persistent rate limit failed:", error);
    return checkRateLimit(key);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRegisteredUser();
    const token = process.env.GITHUB_ISSUES_TOKEN;
    const githubOwner = process.env.GITHUB_OWNER;
    const githubRepo = process.env.GITHUB_REPO;

    if (!(await checkPersistentRateLimit(user.id))) {
      return NextResponse.json(
        { error: "Too many feedback submissions" },
        { status: 429 },
      );
    }

    if (!token) {
      return NextResponse.json(
        { error: "GITHUB_ISSUES_TOKEN is not configured" },
        { status: 503 },
      );
    }

    if (!githubOwner || !githubRepo) {
      return NextResponse.json(
        { error: "GITHUB_OWNER and GITHUB_REPO must be configured" },
        { status: 503 },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      GITHUB_REQUEST_TIMEOUT_MS,
    );

    const response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(githubOwner)}/${encodeURIComponent(githubRepo)}/issues`,
      {
        body: JSON.stringify({
          body: buildIssueBody(parsed.data),
          title: buildIssueTitle(parsed.data),
        }),
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "Bullet-TV-Feedback",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        method: "POST",
        signal: controller.signal,
      },
    ).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      const text = await response.text();
      console.error(
        "[api/ad-feedback] GitHub issue creation failed:",
        text.slice(0, 2000),
      );
      return NextResponse.json(
        { error: "GitHub issue creation failed" },
        { status: 502 },
      );
    }

    let responseData: unknown;
    try {
      responseData = await response.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON response from GitHub" },
        { status: 502 },
      );
    }

    const parsedIssue = issueSchema.safeParse(responseData);
    if (!parsedIssue.success) {
      console.error(
        "[api/ad-feedback] GitHub issue response parsing failed:",
        parsedIssue.error,
      );
      return NextResponse.json(
        { error: "Could not parse GitHub API response" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      issueNumber: parsedIssue.data.number,
      issueUrl: parsedIssue.data.html_url,
      success: true,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("[api/ad-feedback] Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
