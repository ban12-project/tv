# 鹅城 TV (Bullet TV)

**ECheng TV** (English: **Bullet TV**) is a streaming web application built with **advanced web technologies**. It features a unified **Aggregated Search (聚合搜索)** across multiple MAC CMS sources with real-time stream processing, leveraging **Next.js [Cache Components](https://nextjs.org/docs/app/getting-started/cache-components)** for extreme performance.

[![E2E](https://github.com/ban12-project/tv/actions/workflows/e2e.yml/badge.svg?branch=main)](https://github.com/ban12-project/tv/actions/workflows/e2e.yml) ![Next.js 16](https://img.shields.io/badge/Next.js-16-black) ![Tailwind CSS 4](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-0.45-C5F74F) ![Better Auth](https://img.shields.io/badge/Better_Auth-1.0-orange)

## Features

- **Framework**: Next.js 16 (App Router) & React 19 (featuring [Cache Components](https://nextjs.org/docs/app/getting-started/cache-components))
- **Styling**: Tailwind CSS 4 with a custom premium design system
- **Authentication**: Optional Better Auth passkey mode with allowlist upgrades
- **Database**: Optional PostgreSQL on Neon, managed with Drizzle ORM
- **Internationalization**: Full i18n support with a humorous twist (English/Chinese)
- **Streaming**: One-stop **Aggregated Search (聚合搜索)** across multiple providers with real-time stream processing & HLS playback integration

## One-Click Deploy

Deploy your own instance of ECheng TV to your favorite platform.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/ban12-project/tv)

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/ban12-project/tv)

## Development

Use Node.js **26.13.0 LTS** (pinned in `.node-version`) and pnpm **11.0.9**.
With fnm, run `fnm install` and `fnm use` in this checkout. Install pnpm
explicitly (`npm install --global pnpm@11.0.9`); Node 26 does not bundle Corepack.
CI reads `.node-version`; update the Docker image version alongside it.


1. **Clone the repository:**
   ```bash
   git clone https://github.com/ban12-project/tv.git
   cd tv
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Environment Setup:**
   ```bash
   cp .env.example .env
   ```
   Fill in the environment variables for the feature set you want.

   **Minimal mode (no database):**
   - `MAC_CMS_SOURCES`: JSON array of MAC CMS sources. Example:
     ```bash
     MAC_CMS_SOURCES='[{"id":"sample","name":"Sample CMS","url":"https://example.com/api.php/provide/vod/","type":"json"}]'
     ```
   - In this mode, search and playback are public. Login, allowlist, recommendations, watch history, chatbot, and `/verify-cms` are hidden or return 404.

   **Full database/auth mode:**
   - `NEXT_PUBLIC_AUTH_ENABLED` set to any non-empty value at build time
   - `DATABASE_URL` (Neon PostgreSQL)
   - `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`
   - Enables passkey login, allowlist management, `/verify-cms`, recommendations, watch history, and DB-backed CMS sources.
   - By default, auth-enabled deployments are private to preserve existing behavior.

   **Public mode with optional login:**
   - Configure full database/auth mode.
   - Set `ACCESS_MODE=public`.
   - Search and playback stay public. Logged-in registered users get watch history, recommendations, chatbot, and CMS admin controls.

   **Optional feature flags:**
   - Douban Top 250: `SUPABASE_ENDPOINT` and `SUPABASE_ANON_KEY`
   - Chatbot: `OPENAI_API_KEY`, `CF_AIG_TOKEN`, and `CLOUDFLARE_ACCOUNT_ID` plus full database/auth mode

4. **Database Setup (only for full database/auth mode):**
   ```bash
   pnpm db:push
   ```

5. **Start Development Server:**
   ```bash
   pnpm dev
   ```

## Manual Deployment

### Build
To create a production build:

```bash
pnpm build
```

### Deploy
You can host this application on any platform that supports Next.js, including Vercel, Netlify, and Docker.

### Docker deployment
Build the standalone image with public variables for the client bundle:

```bash
docker build \
  --build-arg NEXT_PUBLIC_HOST_URL=https://tv.example.com \
  --build-arg NEXT_PUBLIC_AUTH_ENABLED=1 \
  -t echeng-tv .
```

Run the container with runtime secrets and feature flags from `.env`:

```bash
docker run --env-file .env -p 3000:3000 echeng-tv
```

For minimal public search and playback, set `MAC_CMS_SOURCES` in `.env`. For auth, recommendations, watch history, and CMS admin controls, build with `NEXT_PUBLIC_AUTH_ENABLED` set and also set `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL`.

## Acknowledgments

Special thanks to **Google Gemini** for its indispensable assistance in the development of this project. Its agentic intelligence made the implementation of complex features a breeze.

## License

This project is licensed under the [MIT License](LICENSE).

## Framework migration (2026-11-03)

Next.js and its companion packages are pinned to 16.4.4; React/React DOM to
19.3.1, React types to 19.3.0, and the Babel React Compiler to stable 1.0.0.
Business dependencies retain their existing declared versions.

Migration references: [Next 16.4](https://nextjs.org/blog/next-16-4),
[16.4.4 fixes](https://github.com/vercel/next.js/releases/tag/v16.4.4),
[navigation](https://nextjs.org/blog/improving-navigation-experience-in-v0-with-nextjs-16-4),
and [bundle analysis](https://nextjs.org/blog/ship-less-javascript-with-ai).
The removed `experimental.viewTransition` option is no longer needed with
stable React View Transitions. Cache Components, Partial Prefetching, build
caching and the existing Rust Compiler opt-in remain enabled.

The chat interface is loaded on first opening. On desktop it stays mounted
once opened, preserving drafts and ongoing conversations when closed.
Existing cache lifetimes, invalidation tags and next-episode prefetching remain
unchanged; no additional speculative prefetching is enabled.

### Production navigation tests

`pnpm test:e2e:public` and `pnpm test:e2e:private` build and serve `.next-e2e`
instead of using the development server. Run them sequentially: they share
that output directory. `E2E_BUILD=1` enables the testing API only for this
isolated build; never set it for deployed builds. Normal builds remain
standalone and exclude the testing API. Public tests use the local CMS fixture
and disable external Douban requests. Private tests require a test database
and Better Auth secret; unauthenticated page checks alone do not validate
registered-user behavior.

The watch navigation test asserts that deferred content is absent while the
navigation lock is held and visible after release. This guards against tests
passing with an inactive lock.

Validation on Node 26.13.0: frozen-lockfile installation, Biome and TypeScript
checks passed. Public production E2E: 6 passed, 1 mode-specific skip, including
the navigation-lock assertion, Chinese episode changes and back/forward history.
The normal standalone build passed, its testing API is disabled, and both
`/en` and `/zh` returned HTTP 200 from the standalone server.
Private unauthenticated checks: 2 passed,
4 mode-specific skips, but database-backed behavior remains unverified because
DATABASE_URL is unavailable. English and Chinese homepages were inspected in
Chromium; the Next MCP compilation check returned no issues.

The 16.4 analyzer's before/after graphs show ChatWidget's synchronous dependency
closure falling from 897 to 62 modules; ChatInterface moves to an async edge.
This is a dependency-graph measure, not a whole-page byte or latency reduction.
Snapshots can be reproduced with `E2E_BUILD=1 pnpm exec next analyze --output
--snapshot NAME` and exported with `pnpm exec next analyze export --dist-dir
.next-e2e --snapshot NAME`. Do not run analysis alongside E2E builds in that
same directory. Docker verification requires Docker, which was not installed
in the migration environment. External Douban configuration also needs repair
(the configured endpoint did not resolve during development checks).

The existing local native pnpm launcher reported
`ERR_PNPM_PNPM_ENGINE_IDENTITY_UNVERIFIABLE`. The migration and frozen-lockfile
verification used `npm exec --yes --package=pnpm@11.0.9 -- pnpm install
--frozen-lockfile` successfully, without disabling integrity checks or changing
the global launcher. The Dockerfile installs this same explicit pnpm version
from `packageManager` rather than relying on Corepack.
