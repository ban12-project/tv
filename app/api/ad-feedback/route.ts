import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRegisteredUser, UnauthorizedError } from "@/lib/auth-utils";

const GITHUB_REQUEST_TIMEOUT_MS = 15_000;
const ISSUE_BODY_LIMIT = 60_000;
const ISSUE_TITLE_LIMIT = 256;
const ISSUE_VIDEO_TITLE_LIMIT = 150;

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
  html_url: z.string().url().optional(),
  number: z.number().int().optional(),
});

const payloadSchema = z.object({
  context: z.object({
    episodeIndex: z.number().int().nonnegative(),
    episodeName: z.string().optional(),
    sourceId: z.string().min(1),
    sourceName: z.string().min(1),
    videoId: z.string().min(1),
    videoTitle: z.string().min(1),
  }),
  note: z.string().max(4000).optional(),
  snapshot: z
    .object({
      autoSkip: z.boolean(),
      createdAt: z.string(),
      duration: nullableFiniteNumber,
      hlsErrors: z.array(runtimeEventSchema).max(30),
      hlsEvents: z.array(runtimeEventSchema).max(80),
      latestPlaylistTextExcerpt: z.string().max(20_000).optional(),
      latestPlaylistUrl: z.string().optional(),
      mappedRange: rangeSchema,
      mappedSkipRanges: z.array(rangeSchema).max(100),
      pageUrl: z.string(),
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
      userAgent: z.string(),
      video: z.object({
        currentSrc: z.string(),
        height: z.number().int().nonnegative(),
        src: z.string(),
        width: z.number().int().nonnegative(),
      }),
      videoUrl: z.string(),
    })
    .passthrough(),
});

function truncate(value: string, limit: number) {
  if (value.length <= limit) return value;
  const suffix = `\n\n[truncated ${value.length - limit} chars]`;
  return `${value.slice(0, Math.max(0, limit - suffix.length))}${suffix}`;
}

function formatDebugJson(value: unknown) {
  return truncate(JSON.stringify(value, null, 2), ISSUE_BODY_LIMIT);
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

function buildIssueBody(
  payload: z.infer<typeof payloadSchema>,
  reporter: { id: string },
) {
  const { context, note, snapshot } = payload;
  const summary = [
    "## Summary",
    "",
    `- Video: ${context.videoTitle} (${context.videoId})`,
    `- Source: ${context.sourceName} (${context.sourceId})`,
    `- Episode: ${context.episodeIndex + 1}${context.episodeName ? ` - ${context.episodeName}` : ""}`,
    `- Skip: ${snapshot.seek.from.toFixed(3)}s -> ${snapshot.seek.to.toFixed(3)}s`,
    `- Mapped range: ${snapshot.mappedRange.start.toFixed(3)}s - ${snapshot.mappedRange.end.toFixed(3)}s${snapshot.mappedRange.calibrated ? " (calibrated)" : ""}`,
    `- Page: ${snapshot.pageUrl}`,
    `- Reporter ID: ${reporter.id}`,
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

export async function POST(req: Request) {
  try {
    const user = await requireRegisteredUser();
    const token = process.env.GITHUB_ISSUES_TOKEN;
    const githubOwner = process.env.GITHUB_OWNER;
    const githubRepo = process.env.GITHUB_REPO;

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
          body: buildIssueBody(parsed.data, user),
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
