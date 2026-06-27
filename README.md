# 鹅城 TV (Bullet TV)

**ECheng TV** (English: **Bullet TV**) is a streaming web application built with **advanced web technologies**. It features a unified **Aggregated Search (聚合搜索)** across multiple MAC CMS sources with real-time stream processing, leveraging **Next.js [Cache Components](https://nextjs.org/docs/app/getting-started/cache-components)** for extreme performance.

![Next.js 16](https://img.shields.io/badge/Next.js-16-black) ![Tailwind CSS 4](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-0.45-C5F74F) ![Better Auth](https://img.shields.io/badge/Better_Auth-1.0-orange)

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
  -t echeng-tv .
```

Run the container with runtime secrets and feature flags from `.env`:

```bash
docker run --env-file .env -p 3000:3000 echeng-tv
```

For minimal public search and playback, set `MAC_CMS_SOURCES` in `.env`. For auth, recommendations, watch history, and CMS admin controls, also set `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL`.

## Acknowledgments

Special thanks to **Google Gemini** for its indispensable assistance in the development of this project. Its agentic intelligence made the implementation of complex features a breeze.

## License

This project is licensed under the [MIT License](LICENSE).
