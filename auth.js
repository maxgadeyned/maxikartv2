/* Session tokens (HMAC) */
const crypto = require('crypto');

const SESSION_SECRET = process.env.SESSION_SECRET || 'maxikart-dev-secret-change-me';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 60; // 60 days

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

function fromB64url(str) {
  return Buffer.from(String(str), 'base64url');
}

function signSession(userId) {
  const payload = {
    uid: userId,
    exp: Date.now() + SESSION_TTL_MS
  };
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifySession(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expect = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(fromB64url(body).toString('utf8'));
    if (!payload.uid || !payload.exp || Date.now() > payload.exp) return null;
    return payload.uid;
  } catch (_e) {
    return null;
  }
}

function readBearer(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7).trim();
  return null;
}

module.exports = {
  signSession,
  verifySession,
  readBearer
};
