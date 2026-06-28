import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";
import { hasAuth } from "@/lib/features";

const notFound = () => new Response("Not Found", { status: 404 });

let handlers: ReturnType<typeof toNextJsHandler> | null = null;

function getHandlers() {
  if (!hasAuth()) return null;
  handlers ??= toNextJsHandler(getAuth());
  return handlers;
}

export function GET(request: Request) {
  return getHandlers()?.GET(request) ?? notFound();
}

export function POST(request: Request) {
  return getHandlers()?.POST(request) ?? notFound();
}
