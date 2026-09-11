'use strict';

const http = require('node:http');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 10000);
const APPS_SCRIPT_URL = String(process.env.APPS_SCRIPT_URL || '').trim();
const SERVER_TOKEN = String(process.env.SERVER_TOKEN || '').trim();
const MAX_BODY_BYTES = 32 * 1024;

if (!APPS_SCRIPT_URL || !SERVER_TOKEN) {
  throw new Error('Missing required environment variables: APPS_SCRIPT_URL and/or SERVER_TOKEN');
}

const allowedOrigins = new Set(
  String(process.env.ALLOWED_ORIGINS || 'https://targetai1920-debug.github.io')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
);

const rateBuckets = new Map();

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket.remoteAddress || 'unknown';
}

function rateAllowed(req, bucketName, limit, windowMs) {
  const now = Date.now();
  const key = `${bucketName}:${clientIp(req)}`;
  const current = rateBuckets.get(key);

  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  current.count += 1;
  return current.count <= limit;
}

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateBuckets.entries()) {
    if (value.resetAt <= now) rateBuckets.delete(key);
  }
}, 10 * 60 * 1000);
cleanupTimer.unref();

function originAllowed(req) {
  const origin = req.headers.origin;
  return !origin || allowedOrigins.has(origin);
}

function setCommonHeaders(res, req) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
}

function sendJson(req, res, status, payload) {
  setCommonHeaders(res, req);
  res.statusCode = status;
  res.end(JSON.stringify(payload));
}

function cleanString(value, maxLength = 500) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

function cleanObjectives(value) {
  if (!Array.isArray(value)) return cleanString(value, 1200);
  return value
    .map((item) => cleanString(item, 120))
    .filter(Boolean)
    .slice(0, 20)
    .join('; ');
}

function makeRequestId() {
  return `render:${crypto.randomUUID()}`;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        const error = new Error('body_too_large');
        error.code = 'BODY_TOO_LARGE';
        reject(error);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        const body = raw ? JSON.parse(raw) : {};
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_json');
        resolve(body);
      } catch (error) {
        error.code = error.code || 'INVALID_JSON';
        reject(error);
      }
    });

    req.on('error', reject);
  });
}

async function callAppsScript(action, payload = {}) {
  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      serverToken: SERVER_TOKEN,
      ...payload
    }),
    redirect: 'follow',
    signal: AbortSignal.timeout(15000)
  });

  const raw = await response.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    const error = new Error('apps_script_non_json');
    error.code = 'APPS_SCRIPT_BAD_RESPONSE';
    throw error;
  }

  if (!response.ok || data.ok !== true) {
    const error = new Error('apps_script_error');
    error.code = data && data.error && data.error.code ? data.error.code : 'APPS_SCRIPT_ERROR';
    throw error;
  }

  return data.data || {};
}

function applicationPayload(body) {
  return {
    requestId: cleanString(body.requestId, 128) || makeRequestId(),
    name: cleanString(body.fullName, 120),
    business: cleanString(body.businessName, 160),
    email: cleanString(body.workEmail, 254),
    phone: cleanString(body.phone, 60),
    preferredContact: cleanString(body.contactMethod, 60),
    businessType: cleanString(body.businessType, 100),
    website: cleanString(body.website, 300),
    locations: cleanString(body.locations, 40),
    address: cleanString(body.streetAddress, 240),
    city: cleanString(body.city, 120),
    postcode: cleanString(body.postcode, 30),
    storefrontVisible: cleanString(body.storefrontVisible, 80),
    footTraffic: cleanString(body.footTraffic, 160),
    measurementPoint: cleanString(body.measurePoint, 180),
    powerAvailable: cleanString(body.electricity, 80),
    internetAvailable: cleanString(body.internet, 80),
    installationPermission: cleanString(body.installPermission, 120),
    objectives: cleanObjectives(body.objectives),
    problemToInvestigate: cleanString(body.problem, 2000)
  };
}

async function handleApplication(req, res) {
  if (!rateAllowed(req, 'application', 12, 60 * 60 * 1000)) {
    return sendJson(req, res, 429, { ok: false, error: 'too_many_requests' });
  }

  const body = await readJson(req);
  const payload = applicationPayload(body);

  if (!payload.name || !payload.business || !payload.email) {
    return sendJson(req, res, 400, { ok: false, error: 'missing_required_fields' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return sendJson(req, res, 400, { ok: false, error: 'invalid_email' });
  }

  await callAppsScript('createApplication', payload);
  return sendJson(req, res, 201, { ok: true });
}

async function handleApprovalVerification(req, res) {
  if (!rateAllowed(req, 'approval', 20, 15 * 60 * 1000)) {
    return sendJson(req, res, 429, { ok: false, error: 'too_many_requests' });
  }

  const body = await readJson(req);
  const code = cleanString(body.code, 24).toUpperCase();
  if (!/^TM-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code)) {
    return sendJson(req, res, 200, { ok: true, valid: false });
  }

  const result = await callAppsScript('verifyApprovalCode', { code });
  if (result.valid !== true) {
    return sendJson(req, res, 200, { ok: true, valid: false });
  }

  // Stripe is not connected yet. Do not expose Application ID to the browser.
  // Later this route will create the Stripe Checkout Session server-side.
  return sendJson(req, res, 200, { ok: true, valid: true, paymentReady: false });
}

async function requestHandler(req, res) {
  try {
    if (req.method === 'OPTIONS') {
      if (!originAllowed(req)) return sendJson(req, res, 403, { ok: false, error: 'origin_not_allowed' });
      setCommonHeaders(res, req);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Max-Age', '86400');
      res.statusCode = 204;
      return res.end();
    }

    if (req.method === 'GET' && req.url === '/health') {
      return sendJson(req, res, 200, { ok: true, service: 'target-media-render-backend' });
    }

    if (!originAllowed(req)) {
      return sendJson(req, res, 403, { ok: false, error: 'origin_not_allowed' });
    }

    if (!rateAllowed(req, 'general', 120, 15 * 60 * 1000)) {
      return sendJson(req, res, 429, { ok: false, error: 'too_many_requests' });
    }

    if (req.method === 'POST' && req.url === '/api/applications') {
      return await handleApplication(req, res);
    }

    if (req.method === 'POST' && req.url === '/api/approval/verify') {
      return await handleApprovalVerification(req, res);
    }

    return sendJson(req, res, 404, { ok: false, error: 'not_found' });
  } catch (error) {
    const code = error && error.code ? error.code : 'INTERNAL_ERROR';
    console.error('Request failed:', code);

    if (code === 'INVALID_JSON') return sendJson(req, res, 400, { ok: false, error: 'invalid_json' });
    if (code === 'BODY_TOO_LARGE') return sendJson(req, res, 413, { ok: false, error: 'request_too_large' });
    return sendJson(req, res, 502, { ok: false, error: 'upstream_unavailable' });
  }
}

http.createServer(requestHandler).listen(PORT, '0.0.0.0', () => {
  console.log(`Target Media backend listening on port ${PORT}`);
});
