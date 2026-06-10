/**
 * netlify/functions/reviews.js
 *
 * Secure Airtable proxy for the review system.
 * Credentials NEVER reach the browser — they live in Netlify environment variables.
 *
 * Required env vars (set in Netlify Dashboard → Site Settings → Environment):
 *   AIRTABLE_TOKEN  — Personal Access Token (pat…)
 *   AIRTABLE_BASE   — Base ID (app…)
 *   AIRTABLE_TABLE  — Table name, e.g. "Table 1"
 *
 * Routes:
 *   GET  /.netlify/functions/reviews   → returns approved reviews
 *   POST /.netlify/functions/reviews   → submits a new review (pending approval)
 */

'use strict';

const AIRTABLE_API = 'https://api.airtable.com/v0';

/*
 * CORS allowlist.
 * FIX: Was '*' (any origin). Now scoped to your actual domain so that
 * cross-origin POST requests from random third-party websites are blocked
 * at the browser level.
 *
 * Netlify automatically sets process.env.URL to the live deploy URL, so
 * this works in production without hardcoding. The localhost entry covers
 * `netlify dev` during local development.
 *
 * If you add a custom domain, Netlify sets process.env.URL to that domain
 * automatically — no changes needed here.
 */
const ALLOWED_ORIGINS = [
  process.env.URL || 'https://capable-twilight-6cae0a.netlify.app',
  'http://localhost:8888', // netlify dev default port
].filter(Boolean);

/* ── Helpers ──────────────────────────────────────────────────────────────── */

/** Read and validate required environment variables. Throws on missing. */
function getEnv() {
  const token = process.env.AIRTABLE_TOKEN;
  const base  = process.env.AIRTABLE_BASE;
  const table = process.env.AIRTABLE_TABLE;

  if (!token || !base || !table) {
    throw new Error(
      'Missing env vars. Ensure AIRTABLE_TOKEN, AIRTABLE_BASE, and AIRTABLE_TABLE are set.'
    );
  }
  return { token, base, table };
}

/**
 * Sanitise a value to a plain trimmed string within a max length.
 * Returns '' for non-string / null / undefined inputs.
 */
function sanitise(val, maxLen = 1000) {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

/**
 * Resolve the correct Access-Control-Allow-Origin value.
 * Returns the matched allowlisted origin, or the first entry as the safe
 * default for non-browser requests (curl, Postman, direct server calls).
 *
 * FIX: replaces the previous '*' wildcard that allowed any website to POST
 * reviews via a browser-hosted page.
 */
function resolveCorsOrigin(requestOrigin) {
  if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) {
    return requestOrigin;
  }
  return ALLOWED_ORIGINS[0];
}

/** Build a standard JSON response. corsOrigin is required on every call. */
function jsonRes(statusCode, body, corsOrigin) {
  return {
    statusCode,
    headers: {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': corsOrigin,
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
},
    body: JSON.stringify(body),
  };
}

/* ── Main handler ─────────────────────────────────────────────────────────── */

exports.handler = async (event) => {

  /* Resolve the caller's origin once, at the top, for all responses */
  const requestOrigin = event.headers.origin || event.headers.Origin || '';
  const corsOrigin    = resolveCorsOrigin(requestOrigin);
if (
  requestOrigin &&
  !ALLOWED_ORIGINS.includes(requestOrigin)
) {
  return jsonRes(
    403,
    { error: 'Forbidden origin.' },
    corsOrigin
  );
}

  /* CORS preflight */
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin':  corsOrigin,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Cache-Control': 'no-store',
      },
      body: '',
    };
  }

  /* Load credentials — fail fast with a clear 500 if misconfigured */
  let env;
  try {
    env = getEnv();
  } catch (err) {
    console.error('[reviews] Config error:', err.message);
    return jsonRes(500, { error: 'Server configuration error. Contact the site admin.' }, corsOrigin);
  }

  const { token, base, table } = env;
  const airtableHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  const encodedTable = encodeURIComponent(table);

  /* ── GET: Fetch all approved reviews ──────────────────────────────────── */
  if (event.httpMethod === 'GET') {
    try {
      // Only return records where Approved = 1 (checked checkbox in Airtable)
      const filter = encodeURIComponent("AND({Approved}=1, {Review}!='')");
      const sort   = encodeURIComponent('[{"field":"Created Time","direction":"desc"}]');
      const url    = `${AIRTABLE_API}/${base}/${encodedTable}` +
                     `?filterByFormula=${filter}&sort=${sort}&maxRecords=100`;

      const res = await fetch(url, { headers: airtableHeaders });

      if (!res.ok) {
        const detail = await res.text();
        console.error('[reviews] Airtable GET error:', res.status, detail);
        return jsonRes(502, { error: 'Failed to fetch reviews from data store.' }, corsOrigin);
      }

      const data = await res.json();

      // Shape the data: only expose safe fields, sanitise everything
      const reviews = (data.records || []).map(r => ({
        id:      r.id,
        name:    sanitise(r.fields.Name    || 'Anonymous', 120),
        company: sanitise(r.fields.Company || '',          120),
        rating:  Math.min(5, Math.max(1, parseInt(r.fields.Rating, 10) || 5)),
        review:  sanitise(r.fields.Review  || '',         2000),
      }));

      return jsonRes(200, { reviews }, corsOrigin);

    } catch (err) {
      console.error('[reviews] GET error:', err);
      return jsonRes(500, { error: 'Internal server error.' }, corsOrigin);
    }
  }

  /* ── POST: Submit a new review ────────────────────────────────────────── */
  if (event.httpMethod === 'POST') {

    /* Parse body */
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return jsonRes(400, { error: 'Invalid request body. Expected JSON.' }, corsOrigin);
    }

    /*
     * FIX: Anti-spam honeypot check.
     * The review form includes a hidden text field (_hp) that is invisible
     * to real users (positioned off-screen, zero size). Automated bots that
     * fill all fields will populate it. If it has any content, silently
     * return 201 so the bot thinks it succeeded — this avoids retries.
     */
    const honeypot = sanitise(body._hp, 10);
    if (honeypot) {
      console.log('[reviews] Honeypot triggered — spam submission rejected silently.');
      return jsonRes(201, {
        success: true,
        message: 'Review submitted. It will appear after admin approval.',
      }, corsOrigin);
    }

    /* Sanitise inputs */
    const name    = sanitise(body.name,    120);
    const company = sanitise(body.company, 120);
    const review  = sanitise(body.review, 2000);
    const rating  = parseInt(body.rating, 10) || 0;

    /* Validate */
    if (
  company &&
 !/^[a-zA-Z0-9\s.'&,+/-]{1,120}$/.test(company)
) {
  return jsonRes(
    400,
    { error: 'Invalid company.' },
    corsOrigin
  );
}
if (!/^[a-zA-Z\s.'-]{2,120}$/.test(name)) {
  return jsonRes(
    400,
    { error: 'Invalid name.' },
    corsOrigin
  );
}
    if (!review)                   return jsonRes(400, { error: 'Review text is required.' }, corsOrigin);
    if (review.length < 10)        return jsonRes(400, { error: 'Review is too short (minimum 10 characters).' }, corsOrigin);
    if (rating < 1 || rating > 5)  return jsonRes(400, { error: 'Rating must be between 1 and 5.' }, corsOrigin);

    /* Write to Airtable — Approved is false until admin checks it */
    try {
      const url = `${AIRTABLE_API}/${base}/${encodedTable}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: airtableHeaders,
        body: JSON.stringify({
          records: [{
            fields: {
              Name:     name,
              Company:  company,
              Rating:   rating,
              Review:   review,
              Approved: false, // Admin must approve in Airtable before it goes live
            },
          }],
        }),
      });

      if (!res.ok) {
        const detail = await res.text();
        console.error('[reviews] Airtable POST error:', res.status, detail);
        return jsonRes(502, { error: 'Failed to save review. Please try again.' }, corsOrigin);
      }

      return jsonRes(201, {
        success: true,
        message: 'Review submitted. It will appear after admin approval.',
      }, corsOrigin);

    } catch (err) {
      console.error('[reviews] POST error:', err);
      return jsonRes(500, { error: 'Internal server error.' }, corsOrigin);
    }
  }

  /* Unhandled method */
  return jsonRes(405, { error: 'Method not allowed.' }, corsOrigin);
};
