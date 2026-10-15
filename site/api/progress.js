// PUT /api/progress  { progress: { questionId: 1 | 0 }, lastCh } -> saves the signed-in student's progress
const L = require('./_lib');

module.exports = L.wrap(async (req, res) => {
  if (req.method !== 'PUT') return L.send(res, 405, { error: 'Method not allowed.' });
  if (!L.jsonOnly(req)) return L.send(res, 415, { error: 'Send JSON.' });
  const uname = await L.currentUser(req);
  if (!uname) return L.send(res, 401, { error: 'Signed out. Sign in again to keep saving.' });

  const b = L.body(req), progress = L.cleanProgress(b.progress);
  if (!progress) return L.send(res, 400, { error: 'Bad progress data.' });
  const lastCh = Number.isInteger(b.lastCh) && b.lastCh > 0 && b.lastCh < 100 ? b.lastCh : null;
  await L.redis(['SET', 'progress:' + uname, JSON.stringify({ progress, lastCh, updatedAt: new Date().toISOString() })]);
  return L.send(res, 200, { ok: true });
});
