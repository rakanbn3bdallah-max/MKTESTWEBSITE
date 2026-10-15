// Compact print of parsed test bank for review: node tools/print_tb.js .tmp/tb-1.json
const q = require(require('path').resolve(process.argv[2]));
for (const x of q) {
  if (x.type === 'tf') console.log(`${x.n}|TF|${x.q}|=${x.answer ? 'T' : 'F'}`);
  else console.log(`${x.n}|${x.q}|${x.options.map((o, i) => 'ABCDE'[i] + ') ' + o).join(' ')}|=${'ABCDE'[x.answer]}`);
}
