'use strict';

const MAX_URL_LENGTH = 2048;

/**
 * Returns a normalized URL string if `input` is a well-formed http(s) URL,
 * or null if it's malformed / missing / an unsupported scheme.
 *
 * Runs BEFORE anything touches the store, so a 400 here never leaves a
 * partial record behind.
 *
 * Normalizing via `new URL().toString()` also means trivial variants of the
 * same address (e.g. a bare origin vs. the same origin with a trailing
 * slash) collapse to one canonical string, which helps the "same URL twice"
 * de-duplication catch more real-world duplicates, not just byte-identical ones.
 */
function validateAndNormalizeUrl(input) {
  if (typeof input !== 'string') return null;

  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_URL_LENGTH) return null;

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null; // not a parseable URL at all
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (!parsed.hostname) return null;

  return parsed.toString();
}

module.exports = { validateAndNormalizeUrl };
