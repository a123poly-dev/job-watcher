# Job Watcher

A service that watches company careers pages and emails you when a new vacancy matching your keywords appears.

Add a careers page URL and Job Watcher finds the vacancies on it by itself — no CSS selectors to configure.

## Features

- **Automatic job extraction** — a heuristic parser finds job links on any careers page.
- **Popular ATS support** — Greenhouse, Lever, Ashby, Workable, Teamtailor, Jobylon, Personio, Recruitee, SmartRecruiters, BambooHR, Workday and more.
- **JavaScript-rendered sites** — Next.js/React pages and embedded widgets are opened in headless Chromium (Playwright). The mode is chosen automatically: if a plain fetch finds no jobs, the site switches to browser mode.
- **Keyword filters** — set keywords (e.g. `android`, `designer`) and a recipient per company. An empty keyword means "notify about any new vacancy".
- **Email notifications** via [Resend](https://resend.com).
- **Preview** — when adding a company, see which jobs the parser found.
- **History** — a log of sent notifications and changes.

## Tech stack

| Part | Technologies |
|------|-------------|
| Backend | Node.js, TypeScript, Express, Prisma, SQLite |
| Scraping | Cheerio, Playwright (Chromium) |
| Frontend | React, TypeScript, Vite |
| Email | Resend |
| Hosting | Railway |

## Project structure

```
job-watcher/
├── client/              # React app (Vite)
│   └── src/pages/       # Dashboard, SiteDetail, Settings, History, Notifications, Login
└── server/
    ├── prisma/          # Database schema (SQLite)
    └── src/
        ├── checker.ts   # Checks sites, detects new jobs, sends alerts
        ├── mailer.ts    # Email delivery via Resend
        ├── scraper/     # heuristic.ts — extracts jobs from HTML
        └── routes/      # REST API: auth, sites, filters, recipients, logs, cron
```

## Getting started

Requires Node.js 20+.

```bash
git clone https://github.com/a123poly-dev/job-watcher.git
cd job-watcher
npm install
npm run setup
```

`npm run setup` installs server and client dependencies, creates the database and downloads Chromium for Playwright.

Create `server/.env` (see [Environment variables](#environment-variables)) and run:

```bash
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001

## Environment variables

| Variable | Required | Description |
|----------|:--------:|-------------|
| `DATABASE_URL` | yes | SQLite path, e.g. `file:./dev.db` |
| `APP_PASSWORD` | yes | Password for logging into the UI |
| `SESSION_SECRET` | yes | Random string used to sign sessions |
| `RESEND_API_KEY` | yes | Resend API key for sending email |
| `RESEND_FROM` | no | Sender, defaults to `Job Watcher <onboarding@resend.dev>` |
| `CRON_SECRET` | yes | Token for triggering checks via `/api/cron/run` |
| `PORT` | no | Server port, defaults to `3001` |
| `CLIENT_ORIGIN` | no | Frontend origin for CORS, defaults to `http://localhost:5173` |
| `SESSION_DIR` | no | Directory for session files |
| `NODE_ENV` | no | `production` — the server serves the built frontend |

## Running checks

There is no built-in scheduler. Checks are triggered by an external cron service (Railway Cron, GitHub Actions, cron-job.org, etc.):

```bash
curl -X POST https://<your-app>/api/cron/run \
  -H "Authorization: Bearer $CRON_SECRET"
```

The endpoint responds `202` immediately and checks all sites in the background, or `409` if a run is already in progress. Chromium is launched only if at least one site needs browser mode, and is closed when the run finishes.

A single company can also be checked manually from the UI.

## How job detection works

1. The page is fetched with a plain HTTP request.
2. If it's an SPA shell (Next.js, React, Nuxt, Gatsby) or no jobs are found, the page is opened in Chromium and the site is remembered as browser-rendered.
3. Jobs are extracted from the HTML:
   - Greenhouse data embedded in `__NEXT_DATA__`;
   - Jobylon and Ashby widget cards;
   - links to jobs on the same domain or on known ATS platforms.
4. Jobs are filtered by keywords. New (previously unseen) ones are emailed to recipients. On a site's first check, current jobs are saved as a baseline without notifications.

## Deploying to Railway

Configuration lives in [`railway.json`](railway.json). `npm run build` builds the client and server and installs Chromium; `npm run start` applies the database schema and starts the server.

1. Create a Railway project from this repository.
2. Set the environment variables (including `NODE_ENV=production`).
3. Point an external cron at `POST /api/cron/run`.
