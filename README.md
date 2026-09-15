# URL Shortener

A minimal full-stack URL shortener built with React, Vite, Express, and PostgreSQL. It creates short links, redirects users, tracks clicks, exposes link statistics, and supports deployment as a single Vercel project.

## Features

- Create short URLs from long URLs
- Reuse an existing short code for the same normalized URL
- Random 7-character Base62 short codes
- HTTP 302 redirects
- Click tracking
- Per-link statistics
- PostgreSQL persistence in production
- Fast, self-contained automated API tests
- React/Vite frontend
- Single-project Vercel deployment

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Backend | Node.js + Express |
| Database | PostgreSQL |
| Database driver | `pg` |
| Deployment | Vercel |
| Runtime | Node.js 24.x |

## Project Structure

```text
.
├── api/
│   └── index.js              # Vercel serverless entry point
├── frontend/
│   ├── src/                  # React application
│   └── ...
├── src/
│   ├── app.js                # Express application and routes
│   ├── postgres-store.js     # PostgreSQL persistence
│   └── server.js             # Local HTTP server
├── test/                     # Node test suite
├── vercel.json               # Vercel build and routing configuration
└── package.json
```

## How It Works

1. The client sends a long URL to `POST /api/links`.
2. The API validates and normalizes the URL.
3. A short 7-character Base62 code is generated when a new link is required.
4. The link is persisted in PostgreSQL in production.
5. Visiting `/:code` resolves the destination URL, increments its click count, and returns an HTTP 302 redirect.
6. `GET /api/links/:code` exposes the stored link and click statistics.

## Run Locally

Requirements:

- Node.js 24.x
- PostgreSQL for production-style local testing

Install dependencies:

```bash
npm install
```

Start the API:

```bash
npm start
```

The local API listens on:

```text
http://localhost:3000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

For local frontend development against the API, create `frontend/.env.local`:

```env
VITE_API_URL=http://localhost:3000
```

## Environment Variables

For PostgreSQL-backed operation:

```env
DATABASE_URL=postgresql://user:password@host:5432/database
```

Optional:

```env
DATABASE_SSL=false
FRONTEND_ORIGIN=http://localhost:5173
PORT=3000
```

`DATABASE_URL` is required by the Vercel API entry point. The application uses PostgreSQL persistence instead of relying on server process memory when deployed.

## API Reference

### Health Check

```http
GET /api/health
```

Returns the API/database health status.

### Create a Short Link

```http
POST /api/links
Content-Type: application/json

{"url":"https://example.com/some/long/path?x=1"}
```

The response contains the generated/reused `code`, original `url`, current `clicks`, `createdAt`, and `shortUrl`.

### Get Link Statistics

```http
GET /api/links/:code
```

Returns the stored destination and click statistics for the supplied short code.

### Redirect

```http
GET /:code
```

Resolves the short code, increments its click count, and redirects the client to the original URL with HTTP 302.

## Data Model

The persistent link record contains the information required to resolve and track a short URL:

```text
links
├── id
├── code
├── url
├── normalized_url
├── clicks
└── created_at
```

The short code is unique, while the normalized URL is used to identify duplicate submissions.

## Testing

Run the automated test suite:

```bash
npm test
```

Build the frontend:

```bash
npm run build
```

The tests are intentionally self-contained and use the application's in-memory store, so the API test suite does not require a live PostgreSQL instance.

## Vercel Deployment

The repository is configured as one Vercel project. Keep the **Root Directory** set to the repository root because both the frontend and API are part of the same repository.

The committed `vercel.json` configures:

```text
Build Command: npm run build
Output Directory: frontend/dist
```

The Vercel serverless entry point is:

```text
api/index.js
```

It creates the Express application with the PostgreSQL store and requires `DATABASE_URL`.

### Vercel Environment Variable

Add the following under Vercel Project Settings → Environment Variables:

```env
DATABASE_URL=your-postgresql-connection-string
```

Neon or another hosted PostgreSQL provider can be used as the database.

Optional:

```env
DATABASE_SSL=false
FRONTEND_ORIGIN=https://your-app.vercel.app
```

The normal single-project deployment is same-origin, so `FRONTEND_ORIGIN` is not normally required.

### Vercel Routes

The deployment routes requests as follows:

```text
/                       → React frontend
/health                 → /api/health
/api/*                  → Express API
/:code                  → redirect handler
```

## Design Decisions

### Persistent storage

Production uses PostgreSQL because Vercel Functions are stateless and process memory cannot be treated as durable storage.

### Duplicate URLs

URLs are normalized before storage. Re-submitting an already stored normalized URL returns the existing short link instead of creating unnecessary duplicate records.

### Click tracking

Redirects are handled by the server rather than a static redirect so every successful redirect can increment the stored click counter.

### HTTP 302

The redirect uses HTTP 302 so the server remains in the request path and click tracking continues to work.

## Acceptance Checklist

- [x] React/Vite frontend
- [x] Express API
- [x] PostgreSQL persistence for production
- [x] URL validation and normalization
- [x] Unique short-code generation
- [x] Duplicate URL reuse
- [x] Redirect endpoint
- [x] Click tracking
- [x] Statistics endpoint
- [x] Health endpoint
- [x] Automated tests
- [x] Production build
- [x] Single-project Vercel configuration
