'use strict';

/**
 * In-memory link store.
 *
 * Two maps model what a real database would do with a table like:
 *   links(code PRIMARY KEY, url TEXT UNIQUE, clicks INT, created_at TEXT)
 *
 * `byCode` is the primary index (used for lookup/redirect/stats).
 * `byUrl`  is the unique index on url (used to make creation idempotent).
 *
 * Because Node runs this on a single thread and every method here is
 * synchronous, there's no interleaving between "check if url exists" and
 * "insert it" the way there would be with an async DB round-trip - so this
 * naturally avoids the duplicate-code race condition without needing a
 * transaction. If this were swapped for a real database, the same guarantee
 * would need a UNIQUE constraint on `url` plus a retry-on-conflict, exactly
 * as commented in app.js.
 */
class LinkStore {
  constructor() {
    this.byCode = new Map();
    this.byUrl = new Map();
  }

  findByUrl(url) {
    const code = this.byUrl.get(url);
    return code ? this.byCode.get(code) : undefined;
  }

  findByCode(code) {
    return this.byCode.get(code);
  }

  hasCode(code) {
    return this.byCode.has(code);
  }

  create(url, code) {
    const row = { code, url, clicks: 0, createdAt: new Date().toISOString() };
    this.byCode.set(code, row);
    this.byUrl.set(url, code);
    return row;
  }

  /** Atomically look up + increment in one step, so a lookup can't be stale by the time it's counted. */
  recordClick(code) {
    const row = this.byCode.get(code);
    if (!row) return undefined;
    row.clicks += 1;
    return row;
  }
}

module.exports = { LinkStore };
