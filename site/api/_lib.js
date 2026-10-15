// Shared helpers for the account API (Vercel ignores files starting with "_" as routes).
// Storage: Upstash Redis over its REST API (added from the Vercel Marketplace), no npm packages.
// Set RW_MEMORY_DB=1 to use an in-memory store instead (local testing with tools/dev_server.js).
const crypto = require('crypto');

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const SESSION_DAYS = 90;
const COOKIE = 'rw_session';

/* ---------- storage ---------- */
const mem = new Map(); // key -> { v, exp }
async function memCmd([op, key, ...args]) {
  const now = Date.now(), e = mem.get(key);
  if (e && e.exp && e.exp < now) mem.delete(key);
  const cur = mem.get(key);
  const ttl = () => { const i = args.indexOf('EX'); return i >= 0 ? now + args[i + 1] * 1000 : 0; };
  switch (op) {
    case 'GET': return cur ? cur.v : null;
    case 'SET': if (args.includes('NX') && cur) return null; mem.set(key, { v: args[0], exp: ttl() }); return 'OK';
    case 'DEL': return mem.delete(key) ? 1 : 0;
    case 'INCR': { const v = String((cur ? +cur.v : 0) + 1); mem.set(key, { v, exp: cur ? cur.exp : 0 }); return +v; }
    case 'EXPIRE': if (cur) cur.exp = now + args[0] * 1000; return cur ? 1 : 0;
    default: throw new Error('memory store: unsupported ' + op);
  }
}
async function redis(cmd) {
  if (process.env.RW_MEMORY_DB === '1') return memCmd(cmd.map((x, i) => (i > 2 && typeof x === 'string' && /^\d+$/.test(x) ? +x : x)));
  if (!REDIS_URL || !REDIS_TOKEN) throw Object.assign(new Error('Database not connected'), { status: 503 });
  const r = await fetch(REDIS_URL, { method: 'POST', headers: { Authorization: `Bearer ${REDIS_TOKEN}` }, body: JSON.stringify(cmd) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw Object.assign(new Error('Database error: ' + (j.error || r.status)), { status: 502 });
  return j.result;
}

/* ---------- passwords and sessions ---------- */
const scrypt = (pw, salt) => new Promise((ok, no) => crypto.scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? no(e) : ok(k))));
async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return { salt: salt.toString('hex'), hash: (await scrypt(pw, salt)).toString('hex') };
}
async function checkPassword(pw, rec) {
  const got = await scrypt(pw, Buffer.from(rec.salt, 'hex')), want = Buffer.from(rec.hash, 'hex');
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
const tokenKey = t => 'session:' + crypto.createHash('sha256').update(t).digest('hex');

function readCookie(req) {
  const m = (req.headers.cookie || '').match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([a-f0-9]{64})'));
  return m ? m[1] : null;
}
function isHttps(req) {
  return (req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}
function setCookie(req, res, token, maxAge) {
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isHttps(req) ? '; Secure' : ''}`);
}
async function startSession(req, res, uname) {
  const token = crypto.randomBytes(32).toString('hex');
  await redis(['SET', tokenKey(token), uname, 'EX', String(SESSION_DAYS * 86400)]);
  setCookie(req, res, token, SESSION_DAYS * 86400);
}
async function currentUser(req) {
  const t = readCookie(req);
  return t ? redis(['GET', tokenKey(t)]) : null;
}
async function endSession(req, res) {
  const t = readCookie(req);
  if (t) await redis(['DEL', tokenKey(t)]);
  setCookie(req, res, '', 0);
}

/* ---------- requests ---------- */
// Usernames are case-insensitive: "Rakan" and "rakan" are the same account.
const normName = s => String(s || '').trim().toLowerCase();
const NAME_RE = /^[a-z0-9_.]{3,20}$/;

function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; }
}
// Only same-site JSON requests change state (a cross-site form can't send application/json without a preflight).
function jsonOnly(req) {
  return /^application\/json\b/i.test(req.headers['content-type'] || '');
}
function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}
function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}
// At most `limit` attempts per window per key; returns false once over.
async function allow(key, limit, windowSec) {
  const n = await redis(['INCR', 'rl:' + key]);
  if (n === 1) await redis(['EXPIRE', 'rl:' + key, String(windowSec)]);
  return n <= limit;
}

// Progress: { questionId: 1 (right) | 0 (wrong) }, plus the last chapter opened.
function cleanProgress(p) {
  const out = {};
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  const keys = Object.keys(p);
  if (keys.length > 5000) return null;
  for (const k of keys) {
    if (!/^[\w.-]{1,40}$/.test(k) || (p[k] !== 0 && p[k] !== 1)) return null;
    out[k] = p[k];
  }
  return out;
}

function wrap(handler) {
  return async (req, res) => {
    try { await handler(req, res); } catch (e) {
      console.error(e);
      send(res, e.status || 500, { error: e.status === 503 ? 'Accounts are not set up on the server yet.' : 'Something went wrong. Try again.' });
    }
  };
}

module.exports = { redis, hashPassword, checkPassword, startSession, currentUser, endSession, normName, NAME_RE, body, jsonOnly, send, clientIp, allow, cleanProgress, wrap };
