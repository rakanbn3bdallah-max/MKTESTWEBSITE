// Parses studocu test-bank text (pdftotext raw) into MCQ / TF JSON.
// Usage: node tools/parse_testbank.js .tmp/tb-1.txt > .tmp/tb-1.json
const fs = require('fs');
const raw = fs.readFileSync(process.argv[2], 'utf8');
let lines = raw.split(/\r?\n/).filter(l => !/lOMoARcPSD|Downloaded by|Copyright|Scan to open|Studocu is not|messages\.(pdf_cover|downloaded_by)|^\s*\d+\s*$|^\f/.test(l));
let text = lines.join('\n').replace(/\f/g, '\n');
// split on question numbers in sequence
const qs = []; let expect = 1, idx = 0, starts = [];
const re = /(^|\n|\s)(\d{1,3})\)\s/g; let m;
while ((m = re.exec(text))) { if (+m[2] === expect) { starts.push({ n: expect, at: m.index + m[1].length, body: m.index + m[0].length }); expect++; } }
for (let i = 0; i < starts.length; i++) {
  const s = starts[i], end = i + 1 < starts.length ? starts[i + 1].at : text.length;
  let chunk = text.slice(s.body, end).replace(/\s+/g, ' ').trim();
  const am = chunk.match(/Answer:\s*(TRUE|FALSE|[A-E])(?=\s+Diff:|\s*$)/i);
  if (!am) continue;
  const ans = am[1].trim(); const before = chunk.slice(0, am.index).trim();
  const lo = (chunk.match(/LO:\s*([\d.]+)/) || [])[1] || '';
  if (/^(TRUE|FALSE)$/i.test(ans)) { qs.push({ n: s.n, type: 'tf', q: before, answer: ans.toUpperCase() === 'TRUE', lo }); continue; }
  if (/^[A-E]$/.test(ans)) {
    const parts = before.split(/\s(?=[A-E]\)\s)/);
    const stem = parts.shift().trim();
    const opts = parts.map(p => p.replace(/^[A-E]\)\s*/, '').trim());
    if (opts.length >= 2) qs.push({ n: s.n, type: 'mcq', q: stem, options: opts, answer: 'ABCDE'.indexOf(ans), lo });
  }
}
console.log(JSON.stringify(qs, null, 1));
console.error(process.argv[2], 'parsed', qs.length, 'mcq', qs.filter(q=>q.type==='mcq').length, 'tf', qs.filter(q=>q.type==='tf').length, 'last#', starts.length);
