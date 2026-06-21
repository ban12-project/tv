import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";
import { hasAuth } from "@/lib/features";

const notFound = () => new Response("Not Found", { status: 404 });

const handlers = hasAuth() ? toNextJsHandler(getAuth()) : null;

export const GET = handlers?.GET ?? notFound;
export const POST = handlers?.POST ?? notFound;
