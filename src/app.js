'use strict';

const express = require('express');
const { LinkStore } = require('./store');
const { generateCode } = require('./codegen');
const { validateAndNormalizeUrl } = require('./validate');

function createApp() {
  const app = express();
  const store = new LinkStore();

  app.use(express.json({ limit: '10kb' }));

  // A malformed JSON body should also come back as a clean 400, not a 500.
  app.use((err, req, res, next) => {
    if (err && err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'malformed JSON body' });
    }
    return next(err);
  });

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // Create a short link. Idempotent: submitting the same URL again returns
  // the existing code (200) instead of minting a new one (201).
  app.post('/api/links', (req, res) => {
    const rawUrl = req.body ? req.body.url : undefined;
    const url = validateAndNormalizeUrl(rawUrl);

    if (url === null) {
      // Reject before anything is stored.
      return res.status(400).json({ error: 'url is missing or is not a valid http(s) URL' });
    }

    const existing = store.findByUrl(url);
    if (existing) {
      return res.status(200).json(toPayload(existing, req));
    }

    // Regenerate on the (astronomically unlikely) chance of a code collision.
    let code = generateCode();
    while (store.hasCode(code)) {
      code = generateCode();
    }

    const row = store.create(url, code);
    return res.status(201).json(toPayload(row, req));
  });

  // Stats for a code - does NOT count as a follow.
  app.get('/api/links/:code', (req, res) => {
    const row = store.findByCode(req.params.code);
    if (!row) return res.status(404).json({ error: 'unknown code' });
    return res.status(200).json(toPayload(row, req));
  });

  // Follow a short link. See README for why this is a 302, not a 301.
  app.get('/:code', (req, res) => {
    const row = store.recordClick(req.params.code);
    if (!row) return res.status(404).json({ error: 'unknown code' });
    return res.redirect(302, row.url);
  });

  return app;
}

function toPayload(row, req) {
  const origin = `${req.protocol}://${req.get('host')}`;
  return {
    code: row.code,
    url: row.url,
    clicks: row.clicks,
    createdAt: row.createdAt,
    shortUrl: `${origin}/${row.code}`,
  };
}

module.exports = { createApp };
