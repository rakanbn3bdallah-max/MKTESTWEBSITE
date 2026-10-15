// Finds the textbook page where a phrase is discussed, inside the book chapter that matches the slide chapter.
// Book pages = PDF page - 31. Chapter numbers in this textbook match the slide decks (checked by chapter title).
// Usage as module: lookup(chapter, phrase) -> { page, pdfPage } | null
// Usage from CLI:  node tools/textbook_lookup.js 3 "approach object"
const fs = require('fs');
const path = require('path');
const RAW = path.resolve(__dirname, '..', '.tmp', 'tb-raw.txt'); // pdftotext of TEXTBOOK/MKT301-TEXTBOOK.PDF.pdf
const OFFSET = 31;
// PDF page ranges [first, last] per book chapter (chapter opener page to the page before the next chapter)
const RANGES = { 1: [33, 56], 2: [57, 78], 3: [79, 106], 4: [107, 146], 5: [147, 172], 6: [173, 196], 14: [375, 392] };
const TITLES = { 1: 'Consumer Behavior and Technology', 2: 'Market Segmentation and Real-Time Bidding', 3: 'Consumer Motivation and Personality',
  4: 'Consumer Perception and Positioning', 5: 'Consumer Learning', 6: 'Consumer Attitude Formation and Change', 14: 'Consumer Decision-Making and Diffusion of Innovations' };

let pages;
const norm = s => s.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/-\s*\n\s*/g, '').replace(/\s+/g, ' ');
function load() {
  if (!pages) pages = fs.readFileSync(RAW, 'utf8').split('\f').map(norm);
  return pages;
}
function lookup(ch, phrase) {
  const p = load(), [a, b] = RANGES[ch], q = norm(phrase);
  // whole-word start; whole-word end too unless the phrase is a deliberate prefix ending in '*'
  const prefix = q.endsWith('*');
  const body = (prefix ? q.slice(0, -1) : q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(^|[^a-z0-9])${body}${prefix ? '' : '(?![a-z0-9])'}`);
  const hit = i => { const m = p[i - 1].match(re); return m ? { page: i - OFFSET, pdfPage: i, snippet: p[i - 1].slice(Math.max(0, m.index - 50), m.index + 90) } : null; };
  // skip the chapter opener (objectives list) and the last 3 pages (summary / review questions)
  for (let i = a + 1; i <= b - 3; i++) { const h = hit(i); if (h) return h; }
  for (let i = a; i <= b; i++) { const h = hit(i); if (h) return h; }
  return null;
}
module.exports = { lookup, TITLES, RANGES, OFFSET };
if (require.main === module) {
  const [ch, ...rest] = process.argv.slice(2);
  console.log(lookup(+ch, rest.join(' ')));
}
