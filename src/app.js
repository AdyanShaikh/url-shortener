'use strict';

const express = require('express');
const cors = require('cors');
const { LinkStore } = require('./store');
const { generateCode } = require('./codegen');
const { validateAndNormalizeUrl } = require('./validate');

function createApp(store = new LinkStore()) {
  const app = express();

  const configuredOrigins = (process.env.FRONTEND_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: configuredOrigins.length
        ? (origin, callback) => {
            if (!origin || configuredOrigins.includes(origin)) return callback(null, true);
            return callback(new Error('origin not allowed by CORS'));
          }
        : true,
    }),
  );

  app.use(express.json({ limit: '10kb' }));

  app.use((err, req, res, next) => {
    if (err && err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'malformed JSON body' });
    }
    return next(err);
  });

  app.get(['/health', '/api/health'], async (req, res, next) => {
    try {
      if (typeof store.health === 'function') await store.health();
      return res.status(200).json({ status: 'ok' });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/api/links', async (req, res, next) => {
    try {
      const rawUrl = req.body ? req.body.url : undefined;
      const url = validateAndNormalizeUrl(rawUrl);
      if (url === null) {
        return res.status(400).json({ error: 'url is missing or is not a valid http(s) URL' });
      }

      const existing = await store.findByUrl(url);
      if (existing) return res.status(200).json(toPayload(existing, req));

      let row;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const code = generateCode();
        if (await store.hasCode(code)) continue;
        row = await store.create(url, code);
        break;
      }

      if (!row) return res.status(503).json({ error: 'could not allocate a short code' });
      const created = row.clicks === 0;
      return res.status(created ? 201 : 200).json(toPayload(row, req));
    } catch (error) {
      return next(error);
    }
  });

  app.get('/api/links/:code', async (req, res, next) => {
    try {
      const row = await store.findByCode(req.params.code);
      if (!row) return res.status(404).json({ error: 'unknown code' });
      return res.status(200).json(toPayload(row, req));
    } catch (error) {
      return next(error);
    }
  });

  async function redirect(code, req, res, next) {
    try {
      if (typeof code !== 'string' || !code) return res.status(404).json({ error: 'unknown code' });
      const row = await store.recordClick(code);
      if (!row) return res.status(404).json({ error: 'unknown code' });
      return res.redirect(302, row.url);
    } catch (error) {
      return next(error);
    }
  }

  app.get('/api/redirect', (req, res, next) => redirect(req.query.code, req, res, next));
  app.get('/:code', (req, res, next) => redirect(req.params.code, req, res, next));

  app.use((err, req, res, next) => {
    console.error(err);
    if (res.headersSent) return next(err);
    return res.status(500).json({ error: 'internal server error' });
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
