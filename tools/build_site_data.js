// Builds site/data.js from parsed test banks (.tmp/tb-N.json), slide text (.tmp/chN-slides.json)
// and hand-written annotations (tools/annotations/chN.js).
// Usage: node tools/build_site_data.js
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const tmp = path.join(root, '.tmp');

const chapters = [
  { id: 1, title: 'Consumer Behavior and Technology', exam: 'midterm' },
  { id: 2, title: 'Consumer Segmentation', exam: 'midterm' },
  { id: 3, title: 'Consumer Motivation and Personality', exam: 'midterm' },
  { id: 4, title: 'Consumer Perception and Positioning', exam: 'midterm' },
  { id: 5, title: 'Consumer Learning', exam: 'midterm' },
  { id: 14, title: 'Consumer Decision-Making and Diffusion of Innovations', exam: 'midterm' },
  { id: 6, title: 'Consumer Attitude Formation and Change', exam: 'final' },
];

const DEPTH = require('./annotations/textbook.js');
const { lookup } = require('./textbook_lookup.js');
const REVIEW = process.argv.includes('--review');
const REVIEW_EXP = process.argv.includes('--review-exp');

// The site no longer points questions at slide numbers (the user asked to drop slide references).
// Annotations keep the slide number for the build checks; the published explanation is rewritten without it.
function noSlideRefs(s) {
  const NUMS = String.raw`\d+(?:\s*(?:[–-]|,|and|&)\s*\d+)*`;
  return s
    // parentheticals that cite slides, e.g. "(slide 12)", "(VALS, slide 16)", "(slides 21–24, Table 6.4)"
    .replace(new RegExp(String.raw`\s*\((?:[^()]*?[,;]\s*)?(?:see |also |the )*slides?\s+${NUMS}(?:[,;][^()]*)?\)`, 'gi'), '')
    // inline citations: "Slide 4 defines" -> "The slide defines", "on slides 21–24" -> "on the slides"
    .replace(new RegExp(String.raw`\b(the |on |in |from )?([Ss])lides\s+${NUMS}`, 'g'), (m, pre, s) => (pre || '') + (pre ? 'the slides' : s === 'S' ? 'The slides' : 'the slides'))
    .replace(new RegExp(String.raw`\b(the |on |in |from )?([Ss])lide\s+${NUMS}`, 'g'), (m, pre, s) => (pre || '') + (pre ? 'the slide' : s === 'S' ? 'The slide' : 'the slide'))
    .replace(/\bthe the slide/gi, 'the slide')
    .replace(/\s+([.,;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
// "The slide defines X" -> "Chapter 3 defines X": explanations cite the chapter, not a slide.
function chapterize(s, ch) {
  const C = `Chapter ${ch}`;
  return s
    .replace(/\b(?:on|in|from) the slides?\b/g, `in ${C}`)
    .replace(/\bthe slides? table\b/gi, `the ${C} table`)
    .replace(/\bThe slides (show|list|say|give|define)\b/g, `${C} $1s`)
    .replace(/\b[Tt]he slides?\b/g, C)
    .replace(/(^|[.!?]\s+)([a-z])/g, (m, p, c) => p + c.toUpperCase());
}

// Chapter 6 slides are images (PDF capture), so titles are typed from the slides themselves.
const CH6_TITLES = ['Chapter 6: Consumer Attitude Formation and Change', 'Learning Objectives (1 of 2)', 'Learning Objectives (2 of 2)',
  'Learning Objective 6.1', 'Attitude', 'Example: Wrangler', 'Attitude Formation', 'Role of Personality Factors', 'Role of Attitudes',
  'Learning Objective 6.2', 'The Cognitive Component', 'The Affective Component', 'Likert Scale', 'Semantic Differential Scale',
  'The Conative Component', 'Discussion Questions', 'Altering Consumer Attitudes', 'Learning Objective 6.3', 'Attitude-Toward-Object Model',
  'Other Multi-Attribute Models', 'Multiattribute Models', 'Learning Objective 6.4', 'Functional Approach', 'Example: Utilitarian Function',
  'Learning Objective 6.5', 'Elaboration Likelihood Model', 'Central Route', 'Peripheral Route', 'Applications (1 of 2)',
  'Learning Objective 6.6', 'Dissonance', 'Learning Objective 6.7', 'Attribution Theory', 'Defensive Attribution', 'Applications (2 of 2)',
  'Analyzing Self-Attributions'];
// Image-only slides in the doctor's Chapter 4 deck, titled from what the slide shows.
const TITLE_FIX = { 4: { 6: 'Digital Context in Saudi Arabia', 9: 'How Perception Works (video)', 11: 'From Sensory Stimuli to Interpretation', 14: 'Ultrasonic Ringtones (absolute threshold)', 22: 'Country of Origin', 23: 'Product Placement: 007' } };
const readJson = f => JSON.parse(fs.readFileSync(f, "utf8").replace(/^﻿/, ""));
const clean = s => String(s || '').replace(/\s+/g, ' ').replace(/\s*\.{3}\s*/g, '… ').trim();
let problems = 0, total = 0;

for (const ch of chapters) {
  const dir = path.join(root, 'site', 'slides', 'ch' + ch.id);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jpg')).sort();
  const texts = readJson(path.join(tmp, `ch${ch.id}-slides.json`));
  ch.slides = files.map((f, i) => {
    const raw = String((texts.find(x => x.n === i + 1) || {}).text || '');
    const t = clean(raw);
    let title = ch.id === 6 ? (CH6_TITLES[i] || '')
      : clean(raw.split(/[\r\n\u000b]+/).map(s => s.trim()).find(s => s && !/^\d+$/.test(s)) || '');
    title = (TITLE_FIX[ch.id] || {})[i + 1] || title;
    title = title.replace(/^\d{1,2}\s+(?=[A-Z])/, '').slice(0, 80);
    return { img: `slides/ch${ch.id}/${f}`, title: title || `Slide ${i + 1}`, text: t };
  });
  const bank = readJson(path.join(tmp, `tb-${ch.id}.json`));
  const ann = require(path.join(__dirname, 'annotations', `ch${ch.id}.js`));
  ch.questions = [];
  for (const [n, a] of Object.entries(ann)) {
    const q = bank.find(x => x.n === +n);
    if (!q) { console.error(`ch${ch.id} q${n}: not in bank`); problems++; continue; }
    const [slide, exp, book, stem] = a;
    if (!slide || slide > ch.slides.length) { console.error(`ch${ch.id} q${n}: bad slide ${slide}`); problems++; }
    if (q.type === 'tf' && !/^(TRUE|FALSE)\./.test(exp)) { console.error(`ch${ch.id} q${n}: TF explanation should start with TRUE./FALSE.`); problems++; }
    if (q.type === 'tf' && exp.startsWith(q.answer ? 'FALSE' : 'TRUE')) { console.error(`ch${ch.id} q${n}: TF explanation contradicts key`); problems++; }
    const out = { id: `${ch.id}-${n}`, n: +n, type: q.type, q: clean(stem || q.q), answer: q.answer, exp: chapterize(noSlideRefs(exp), ch.id) };
    if (/slide\s*\d/i.test(out.exp)) { console.error(`ch${ch.id} q${n}: slide number left in explanation: ${out.exp}`); problems++; }
    if (REVIEW_EXP) console.log(`ch${ch.id} q${n}: ${out.exp}`);
    if (q.type === 'mcq') out.options = q.options.map(clean);
    if (book) out.book = book;
    const phrase = (DEPTH[ch.id] || {})[n];
    if (phrase) {
      const ref = lookup(ch.id, phrase);
      if (!ref) { console.error(`ch${ch.id} q${n}: textbook phrase "${phrase}" not found in book chapter`); problems++; }
      else {
        out.depth = 'book';
        out.ref = `Book Ch. ${ch.id}, p. ${ref.page}`;
        out.page = ref.page;
        if (REVIEW) console.log(`ch${ch.id} q${n} [${phrase}] p.${ref.page}: …${ref.snippet}…`);
      }
    } else if (book) { console.error(`ch${ch.id} q${n}: has a textbook note but no textbook-depth phrase`); problems++; }
    ch.questions.push(out);
  }
  total += ch.questions.length;
  console.log(`Ch ${ch.id}: ${ch.slides.length} slides, ${ch.questions.length}/${bank.length} questions in scope`);
}

// Textbook reader: only the book chapters that match a slide chapter (same name), as compressed page images
// (tools/render_book_chapters.ps1) plus each page's text for searching. Written to site/book.js, loaded on demand.
{
  const { RANGES } = require('./textbook_lookup.js');
  const rawPages = fs.readFileSync(path.join(tmp, 'tb-raw.txt'), 'utf8').split('\f');
  const bookText = t => t.replace(/�/g, '•').replace(/-\n(?=[a-z])/g, '').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n\n').replace(/([^\n])\n(?!\n)/g, '$1 ').trim();
  const book = { chapters: [] };
  for (const ch of chapters) {
    const [a, b] = RANGES[ch.id], dir = path.join(root, 'site', 'book', 'ch' + ch.id);
    const pages = [];
    for (let i = a; i <= b; i++) {
      const p = i - 31, img = `book/ch${ch.id}/p${String(p).padStart(3, '0')}.jpg`;
      if (!fs.existsSync(path.join(root, 'site', img))) { console.error(`book ch${ch.id}: missing ${img} (run tools/render_book_chapters.ps1)`); problems++; continue; }
      pages.push({ p, img, text: bookText(rawPages[i - 1] || '') });
    }
    book.chapters.push({ id: ch.id, title: ch.title, pages });
    ch.book = { first: a - 31, last: b - 31, count: pages.length };
  }
  fs.writeFileSync(path.join(root, 'site', 'book.js'), 'window.MKT_BOOK = ' + JSON.stringify(book) + ';\n');
  console.log(`Textbook: ${book.chapters.reduce((n, c) => n + c.pages.length, 0)} pages written to site/book.js`);
}

const data = { generated: new Date().toISOString().slice(0, 10), chapters };
fs.writeFileSync(path.join(root, 'site', 'data.js'), 'window.MKT_DATA = ' + JSON.stringify(data) + ';\n');
console.log(`Total questions: ${total}. Problems: ${problems}`);
process.exit(problems ? 1 : 0);
