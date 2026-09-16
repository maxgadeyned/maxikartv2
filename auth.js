/* Session tokens + Google ID token verify (no extra npm deps) */
const crypto = require('crypto');
const https = require('https');

const SESSION_SECRET = process.env.SESSION_SECRET || 'maxikart-dev-secret-change-me';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
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

function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(data) });
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function verifyGoogleIdToken(idToken) {
  if (!GOOGLE_CLIENT_ID) {
    const err = new Error('google-disabled');
    err.code = 'google-disabled';
    throw err;
  }
  if (!idToken) {
    const err = new Error('missing-token');
    err.code = 'missing-token';
    throw err;
  }
  const url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
  const { status, json } = await httpsGetJson(url);
  if (status !== 200 || !json || !json.sub) {
    const err = new Error('bad-google-token');
    err.code = 'bad-google-token';
    throw err;
  }
  if (json.aud !== GOOGLE_CLIENT_ID) {
    const err = new Error('bad-google-aud');
    err.code = 'bad-google-aud';
    throw err;
  }
  return {
    sub: json.sub,
    email: json.email || null,
    name: json.name || json.given_name || null
  };
}

function readBearer(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7).trim();
  return null;
}

module.exports = {
  GOOGLE_CLIENT_ID,
  signSession,
  verifySession,
  verifyGoogleIdToken,
  readBearer
};
