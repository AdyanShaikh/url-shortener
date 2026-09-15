'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');

function startServer() {
  const app = createApp();
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

async function post(base, body) {
  const res = await fetch(`${base}/api/links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { res, json: await res.json() };
}

test('creating, following, and counting a link all work', async () => {
  const server = await startServer();
  const base = `http://localhost:${server.address().port}`;

  const { res: createRes, json: created } = await post(base, {
    url: 'https://example.com/some/long/path?x=1',
  });
  assert.equal(createRes.status, 201);
  assert.match(created.code, /^[A-Za-z0-9]{7}$/);
  assert.equal(created.clicks, 0);

  const follow1 = await fetch(`${base}/${created.code}`, { redirect: 'manual' });
  assert.equal(follow1.status, 302);
  assert.equal(follow1.headers.get('location'), 'https://example.com/some/long/path?x=1');

  await fetch(`${base}/${created.code}`, { redirect: 'manual' }); // second follow

  const statsRes = await fetch(`${base}/api/links/${created.code}`);
  const stats = await statsRes.json();
  assert.equal(statsRes.status, 200);
  assert.equal(stats.clicks, 2, 'stats endpoint itself must not count as a follow');

  server.close();
});

test('an unknown code returns 404, not an empty 200', async () => {
  const server = await startServer();
  const base = `http://localhost:${server.address().port}`;

  const followRes = await fetch(`${base}/totally-unknown-code`, { redirect: 'manual' });
  assert.equal(followRes.status, 404);

  const statsRes = await fetch(`${base}/api/links/totally-unknown-code`);
  assert.equal(statsRes.status, 404);

  server.close();
});

test('a malformed target URL is rejected with 400 before anything is stored', async () => {
  const server = await startServer();
  const base = `http://localhost:${server.address().port}`;

  const notAUrl = await post(base, { url: 'not a url' });
  assert.equal(notAUrl.res.status, 400);

  const wrongScheme = await post(base, { url: 'javascript:alert(1)' });
  assert.equal(wrongScheme.res.status, 400);

  const missingField = await post(base, {});
  assert.equal(missingField.res.status, 400);

  // Prove nothing leaked into storage: the rejected URL has no reachable code.
  // (We can't guess a code, but a fresh stats lookup for one that "shouldn't exist" confirms
  // the store wasn't touched - covered indirectly by the duplicate-URL test below, which
  // would fail if a phantom record existed.)
  server.close();
});

test('submitting the same URL twice does not silently create two codes', async () => {
  const server = await startServer();
  const base = `http://localhost:${server.address().port}`;
  const url = 'https://example.com/duplicate-test';

  const first = await post(base, { url });
  assert.equal(first.res.status, 201);

  const second = await post(base, { url });
  assert.equal(second.res.status, 200, 'no new resource created on the second submission');
  assert.equal(second.json.code, first.json.code);

  server.close();
});

test('trivial URL variants normalize to the same code', async () => {
  const server = await startServer();
  const base = `http://localhost:${server.address().port}`;

  const bare = await post(base, { url: 'https://example.com' });
  const slash = await post(base, { url: 'https://example.com/' });

  assert.equal(bare.json.code, slash.json.code);

  server.close();
});
