'use strict';

const { createApp } = require('../src/app');
const { PostgresLinkStore } = require('../src/postgres-store');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for the Vercel deployment');
}

const app = createApp(new PostgresLinkStore());

module.exports = app;
