// GET    /api/session  -> { user, progress, lastCh } for the signed-in student, or { user: null }
// POST   /api/session  { mode: "login" | "signup", username, password } -> signs in (sets an HttpOnly cookie)
// DELETE /api/session  -> signs out
const L = require('./_lib');

async function payload(uname) {
  const [u, p] = await Promise.all([L.redis(['GET', 'user:' + uname]), L.redis(['GET', 'progress:' + uname])]);
  const saved = p ? JSON.parse(p) : {};
  return { user: u ? JSON.parse(u).name : uname, progress: saved.progress || {}, lastCh: saved.lastCh || null };
}

module.exports = L.wrap(async (req, res) => {
  if (req.method === 'GET') {
    const uname = await L.currentUser(req);
    return L.send(res, 200, uname ? await payload(uname) : { user: null });
  }

  if (req.method === 'DELETE') {
    await L.endSession(req, res);
    return L.send(res, 200, { user: null });
  }

  if (req.method !== 'POST') return L.send(res, 405, { error: 'Method not allowed.' });
  if (!L.jsonOnly(req)) return L.send(res, 415, { error: 'Send JSON.' });

  const b = L.body(req), mode = b.mode, uname = L.normName(b.username), pw = String(b.password || '');
  if (!(await L.allow('auth:' + L.clientIp(req), 30, 900))) return L.send(res, 429, { error: 'Too many tries. Wait 15 minutes and try again.' });

  if (mode === 'signup') {
    if (!L.NAME_RE.test(uname)) return L.send(res, 400, { error: 'Username: 3–20 characters, letters, numbers, _ or . only.' });
    if (pw.length < 6 || pw.length > 100) return L.send(res, 400, { error: 'Password: at least 6 characters.' });
    const rec = Object.assign({ name: String(b.username).trim(), created: new Date().toISOString() }, await L.hashPassword(pw));
    const ok = await L.redis(['SET', 'user:' + uname, JSON.stringify(rec), 'NX']);
    if (!ok) return L.send(res, 409, { error: 'That username is taken. Pick another, or sign in if it is yours.' });
    await L.startSession(req, res, uname);
    return L.send(res, 200, await payload(uname));
  }

  if (mode === 'login') {
    const raw = L.NAME_RE.test(uname) ? await L.redis(['GET', 'user:' + uname]) : null;
    if (!raw || !(await L.checkPassword(pw, JSON.parse(raw)))) return L.send(res, 401, { error: 'Wrong username or password.' });
    await L.startSession(req, res, uname);
    return L.send(res, 200, await payload(uname));
  }

  return L.send(res, 400, { error: 'Unknown request.' });
});
