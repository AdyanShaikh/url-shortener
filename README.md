# url-shortener

A minimal URL shortener with a React/Vite frontend, Express API, persistent PostgreSQL storage, click tracking, and a single-project Vercel deployment.

## Run locally

```bash
npm install
npm start
```

The API listens on `http://localhost:3000`.

Frontend:

```bash
cd frontend
npm install
npm run dev
```

For local frontend development against the API, create `frontend/.env.local`:

```env
VITE_API_URL=http://localhost:3000
```

## Test

```bash
npm test
npm run build
```

The API tests use the in-memory store, so they do not require a database.

## Vercel deployment

This repository is configured as **one Vercel project**. Vercel builds the Vite frontend from `frontend/` and exposes the Express application from `api/index.js` as a Vercel Function.

The resulting routes are:

```text
https://your-app.vercel.app/                 → React frontend
https://your-app.vercel.app/api/health       → API health
https://your-app.vercel.app/api/links        → create links
https://your-app.vercel.app/api/links/:code  → link statistics
https://your-app.vercel.app/:code             → redirect + click tracking
```

### Required Vercel environment variable

Set this in Vercel Project Settings → Environment Variables:

```env
DATABASE_URL=your-postgresql-connection-string
```

Use a hosted PostgreSQL provider such as Neon. The database schema is created automatically on first API use.

Optional:

```env
DATABASE_SSL=false
FRONTEND_ORIGIN=https://your-app.vercel.app
```

`FRONTEND_ORIGIN` is only needed when the API is called from another origin. The normal single-project deployment is same-origin and does not require it.

### Vercel settings

When importing the repository, keep the **Root Directory at the repository root**.

Vercel will use the committed `vercel.json` configuration:

```text
Build Command: npm run build
Output Directory: frontend/dist
```

Do not set `frontend` as the Root Directory, because the API lives in the root `api/` directory.

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/links` | Create or reuse a short link |
| GET | `/api/links/:code` | Get click statistics |
| GET | `/:code` | Redirect and increment clicks |
| GET | `/api/health` | API/database health check |

### Create

```http
POST /api/links
Content-Type: application/json

{"url":"https://example.com/some/long/path?x=1"}
```

Returns a payload containing `code`, `url`, `clicks`, `createdAt`, and `shortUrl`.

### Design notes

- Short codes are random 7-character base62 values.
- URLs are normalized and duplicate submissions reuse the existing code.
- Redirects use HTTP 302 so every follow reaches the server and can be counted.
- Production storage uses PostgreSQL rather than process memory, which is required for reliable persistence on Vercel Functions.
- Local tests retain the original in-memory store so the test suite stays fast and self-contained.
