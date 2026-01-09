# 鹅城 TV (Bullet TV)

**ECheng TV** (English: **Bullet TV**) is a streaming web application built with **advanced web technologies**. It features a unified **Aggregated Search (聚合搜索)** across multiple MAC CMS sources with real-time stream processing, leveraging **Next.js [Cache Components](https://nextjs.org/docs/app/getting-started/cache-components)** for extreme performance.

![Next.js 16](https://img.shields.io/badge/Next.js-16-black) ![Tailwind CSS 4](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-0.45-C5F74F) ![Better Auth](https://img.shields.io/badge/Better_Auth-1.0-orange)

## Features

- **Framework**: Next.js 16 (App Router) & React 19 (featuring [Cache Components](https://nextjs.org/docs/app/getting-started/cache-components))
- **Styling**: Tailwind CSS 4 with a custom premium design system
- **Authentication**: Secure, customizable auth via Better Auth (supports Passkeys)
- **Database**: PostgreSQL on Neon, managed with Drizzle ORM
- **Internationalization**: Full i18n support with a humorous twist (English/Chinese)
- **Streaming**: One-stop **Aggregated Search (聚合搜索)** across multiple providers with real-time stream processing & HLS playback integration

## One-Click Deploy

Deploy your own instance of ECheng TV to your favorite platform.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/ban12-project/tv)

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/ban12-project/tv)

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/ban12-project/tv)

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
   Fill in the required environment variables in `.env`.
   - `DATABASE_URL` (Neon PostgreSQL)
   - `BETTER_AUTH_SECRET` & `BETTER_AUTH_URL`
   - `SUPABASE_ENDPOINT` & `SUPABASE_ANON_KEY` (Optional, for Douban features)

4. **Database Setup:**
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
You can host this application on any platform that supports Next.js (Vercel, Netlify, Docker, etc.). 

For Docker or self-hosting, ensure you set the environment variables in your deployment environment.

## Acknowledgments

Special thanks to **Google Gemini** for its indispensable assistance in the development of this project. Its agentic intelligence made the implementation of complex features a breeze.

## License

This project is licensed under the [MIT License](LICENSE).
