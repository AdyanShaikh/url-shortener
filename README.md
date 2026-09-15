# url-shortener

A minimal HTTP service that turns a long URL into a short code, redirects on
lookup, and tracks how many times each code has been followed.

## Run it

```
npm install
npm start          # listens on http://localhost:3000 (set PORT to override)
```

## Test it

```
npm test
```

`test/api.test.js` uses Node's built-in test runner (`node:test`) and starts
a real in-process HTTP server per test, so it exercises the actual routes
end-to-end rather than calling functions directly. It covers every item on
the review checklist: create/follow/count, 404 on an unknown code, 400 on a
malformed URL before storage, and no duplicate codes for a duplicate URL.

## API

| Method | Path               | Purpose                                    |
|--------|--------------------|---------------------------------------------|
| POST   | `/api/links`       | Create (or reuse) a short code for a URL    |
| GET    | `/:code`           | Follow the code — redirects and counts it   |
| GET    | `/api/links/:code` | Stats for a code — does **not** count as a follow |
| GET    | `/health`          | Liveness check                              |

**Create:**
```
POST /api/links
{"url": "https://example.com/some/very/long/path?x=1"}

201 Created  (or 200 if this URL already has a code)
{"code": "vUUfbgs", "url": "...", "clicks": 0, "createdAt": "...", "shortUrl": "http://localhost:3000/vUUfbgs"}
```

**Follow:**
```
GET /vUUfbgs
302 Found
Location: https://example.com/some/very/long/path?x=1
```

**Malformed input:**
```
POST /api/links
{"url": "not a url"}

400 Bad Request
{"error": "url is missing or is not a valid http(s) URL"}
```

**Unknown code:**
```
GET /nope-not-real
404 Not Found
{"error": "unknown code"}
```

## Design decisions

### Why 302, not 301

This is the one decision here that's genuinely hard to undo, because once a
browser caches a 301 it may never ask the server again — so it's worth
spelling out the reasoning rather than just picking one.

**302 (Found) is the correct choice, and it's not close:**

- **The requirement is to count every follow.** A 301 is a signal to the
  client that the mapping is permanent, and browsers (and some
  intermediate proxies) are free to cache that and stop asking the server
  at all on the next visit. If that happens, the click counter silently
  stops incrementing after the first hit per client — the service would be
  *lying* about how often a link was followed. A 302 tells the client not
  to skip the server, so every follow is guaranteed to actually reach the
  route that increments the counter.
- **A short code is a mutable pointer, not a permanent alias.** Nothing
  about "create a short link" implies the target can never change or the
  link can never be retired/disabled. 301 semantically asserts "this
  resource has permanently moved here, forget the old address" — that's a
  stronger and different claim than what a link shortener is actually
  doing.
- **Irreversibility cuts only one way.** If 302 turns out to be wrong later,
  switching to 301 is trivial — nothing is cached yet. If 301 is chosen and
  turns out to be wrong (e.g. the counting requirement, or wanting to point
  the code somewhere else later), there's no way to un-cache it from every
  client that already hit it. Given a requirement to count follows, that
  risk isn't worth taking.

The usual counter-argument for 301 is SEO/cache efficiency (fewer round
trips, link equity passed to the target). Those don't apply to the
requirements given here — accurate counting is an explicit requirement, and
SEO wasn't.

### Idempotent creation (no duplicate codes for the same URL)

The store keeps a second index from normalized URL → code (the in-memory
equivalent of a `UNIQUE` constraint on a `url` column). On create:

1. The URL is validated and normalized first (`new URL(x).toString()`),
   which also means trivial variants like `https://example.com` and
   `https://example.com/` collapse to the same canonical string.
2. If that normalized URL already has a code, the existing record is
   returned with **200 OK** (nothing new created).
3. Otherwise a new code is generated and stored, returned with **201
   Created**.

Because the store's operations are synchronous and Node is single-threaded,
there's no window between "check if it exists" and "insert it" for a race
to sneak through — unlike a real multi-connection database, which would
need the actual `UNIQUE` constraint plus a retry-on-conflict (the code
comments in `app.js`/`store.js` call this out explicitly, since swapping in
a real DB is the obvious next step).

### Validation before storage

`validate.js` runs before the store is touched at all. `POST /api/links`
rejects with 400 when the body has no `url`, the value isn't a string,
it's not parseable as a URL, or the scheme isn't `http`/`https` (e.g.
rejects `javascript:...`, `ftp://...`). Nothing is written to the store on
that path.

### Known limitations

- **Storage is in-memory** — it resets on restart. That's a deliberate
  scope cut for this exercise, not an oversight; the store is behind a
  small interface (`store.js`) specifically so it can be swapped for
  SQLite/Postgres/MariaDB without touching the routes.
- **No auth / rate limiting** — anyone who can reach the service can create
  links or hammer the redirect endpoint. Fine for this exercise; would need
  addressing before this touched the public internet.
- **Codes are random, not sequential** — avoids leaking creation order or
  making codes guessable/enumerable.
