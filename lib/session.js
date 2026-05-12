// Server-only session helpers. Cookie format is `<payload_b64url>.<sig_b64url>`
// where payload is HMAC-SHA256-signed with SESSION_SECRET. Kept tiny on purpose
// — no JWT library, no audience/issuer fields — because the only thing the
// server needs to know is "this request carries a previously-issued PIN auth."
//
// NEVER import this file from client code; the secret would leak into the
// browser bundle.

import crypto from 'node:crypto';

const COOKIE_NAME = 'hm_session';
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days. The app is opt-in re-auth.

function getSecret() {
  const s = process.env.SESSION_SECRET;
  // 32 chars is the minimum that makes brute-force HMAC search uneconomical.
  // Throwing here keeps a misconfigured deploy from silently issuing tokens
  // that anyone can forge.
  if (!s || s.length < 32) {
    throw new Error('SESSION_SECRET missing or too short (need >= 32 chars).');
  }
  return s;
}

function sign(payloadB64) {
  return crypto.createHmac('sha256', getSecret()).update(payloadB64).digest();
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function cookieAttrs() {
  // Secure must be off in `next dev` (HTTP) or browsers reject the cookie.
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `HttpOnly; SameSite=Strict; Path=/${secure}`;
}

export function createSessionCookie({ playerId, name, isAdmin }) {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const payload = JSON.stringify({ playerId, name, isAdmin: !!isAdmin, exp });
  const payloadB64 = Buffer.from(payload, 'utf8').toString('base64url');
  const sigB64 = sign(payloadB64).toString('base64url');
  return `${COOKIE_NAME}=${payloadB64}.${sigB64}; ${cookieAttrs()}; Max-Age=${TTL_SECONDS}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; ${cookieAttrs()}; Max-Age=0`;
}

export function readSession(req) {
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;

  const raw = match[1];
  const dot = raw.indexOf('.');
  if (dot < 0) return null;

  const payloadB64 = raw.slice(0, dot);
  const sigB64 = raw.slice(dot + 1);

  let expectedSig, providedSig;
  try {
    expectedSig = sign(payloadB64);
    providedSig = Buffer.from(sigB64, 'base64url');
  } catch {
    return null;
  }
  if (!safeEqual(providedSig, expectedSig)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  return { playerId: payload.playerId, name: payload.name, isAdmin: !!payload.isAdmin };
}
