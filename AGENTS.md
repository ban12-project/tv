<!-- BEGIN:nextjs-agent-rules -->
 
# Next.js: ALWAYS read docs before coding
 
Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.
 
<!-- END:nextjs-agent-rules -->

## Project Overview

"ECheng TV" is a premium Next.js streaming web application.

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Linting/Formatting**: Biome
- **Internationalization**: Custom i18n implementation with `[lang]` routing.

## Key Dependencies & APIs

To ensure correct API usage, please refer to these specific versions:

- **Next.js**: `16.3.0-preview.5` (React 19, App Router)
- **React**: `^19.2.3`
- **Better Auth**: `^1.4.7` (with `@better-auth/passkey`)
- **Drizzle ORM**: `^0.45.1` (with `drizzle-kit ^0.31.8`)
- **Database**: Neon (PostgreSQL) via `@neondatabase/serverless`
- **UI Components**: Radix UI primitives
- **Icons**: Lucide React (`^0.561.0`)
- **Styling**: Tailwind CSS (`^4.1.18`)
- **Validation**: Zod (`^4.2.1`)

## Core Features & Architecture

- **Authentication**: Powered by Better Auth. Supports anonymous login and passkey upgrades.
- **Database**: PostgreSQL with Drizzle ORM. Schema and migrations are located in `lib/db`.
- **Internationalization**: Uses `i18n-config.ts` and `dictionaries/`. The `proxy.ts` handles locale detection.
- **Video Playback**: Uses `hls.js` (`^1.6.15`) for streaming.
- **Theme**: Supports light/dark modes via `next-themes`.

## Building and Running

1.  **Install dependencies:** `pnpm install`
2.  **Dev server:** `pnpm dev` (runs on `http://localhost:3000`)
3.  **Database operations:**
    - `pnpm db:generate`: Generate migrations
    - `pnpm db:push`: Push schema to database
    - `pnpm db:studio`: Open Drizzle Studio

## Development Conventions

- **Biome**: Use `pnpm check` for linting and `pnpm format` (via lint-staged).
- **Components**: UI primitives in `components/ui`. Business logic components in `components/`.
- **Routing**: Always use the `[lang]` parameter for dynamic routing.

## Internationalization & Style

- **Translation Strategy**: Use `getDictionary(lang)` in Server Components and pass down the `dictionary` to Client Components.
- **Tone & Voice**: The application uses a **highly humorous, creative, and non-traditional tone**.
  - **Chinese (zh)**: Incorporates many movie quotes (specifically from _Let the Bullets Fly_), internet slang, and "Jianghu" (underground) style terminology. (e.g., "让我知道知道你是谁" for Sign In).
  - **English (en)**: Uses an informal, "hacker/特工/sci-fi" style tone (e.g., "Who goes there?" for Sign In, "Fresh meat?" for Sign Up).
  - **Loading States**: Should use creative onomatopoeia or movie references (e.g., "呜————咔嚓咔嚓咔嚓..." for Chinese).
- **Hardcoding**: **STRICTLY PROHIBITED**. All user-facing text must be fetched from `dictionaries/`.

**When starting work on a Next.js project, ALWAYS call the `init` tool from next-devtools-mcp FIRST to set up proper context and establish documentation requirements. Do this automatically without being asked.**
