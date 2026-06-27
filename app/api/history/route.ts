import { type NextRequest, NextResponse } from "next/server";
import { getWatchProgress } from "@/lib/actions/history";
import { getCurrentSession } from "@/lib/auth-utils";
import { hasAuth, hasDatabase } from "@/lib/features";
import {
  upsertWatchProgressForUser,
  watchProgressSchema,
} from "@/lib/watch-history";

export async function GET(req: NextRequest) {
  if (!hasDatabase() || !hasAuth()) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const videoId = req.nextUrl.searchParams.get("videoId");
  const sourceId = req.nextUrl.searchParams.get("sourceId");

  if (!videoId || !sourceId) {
    return new NextResponse("Invalid payload", { status: 400 });
  }

  const progress = await getWatchProgress(videoId, sourceId);
  return NextResponse.json(progress);
}

export async function POST(req: NextRequest) {
  if (!hasDatabase() || !hasAuth()) {
    return new NextResponse("Not Found", { status: 404 });
  }

  try {
    const session = await getCurrentSession();
    if (!session?.user || session.user.isAnonymous) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    let payload: unknown;

    // sendBeacon sends text/plain or application/x-www-form-urlencoded
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      payload = await req.json();
    } else {
      // fallback for sendBeacon
      const text = await req.text();
      try {
        payload = JSON.parse(text);
      } catch {
        return new NextResponse("Invalid JSON", { status: 400 });
      }
    }

    const validated = watchProgressSchema.safeParse(payload);
    if (!validated.success) {
      return new NextResponse("Invalid payload", { status: 400 });
    }

    await upsertWatchProgressForUser(session.user.id, validated.data);

    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("[api/history/route.ts] Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
