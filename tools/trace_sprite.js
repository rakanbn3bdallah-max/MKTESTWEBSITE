// Traces pixel-art sprites from a 24-bit BMP into character grids (R=red, S=skin, K=black, .=empty).
// Usage: node tools/trace_sprite.js .tmp/mario.bmp x0 y0 x1 y1 [cell]
const fs = require('fs');
const [file, ...nums] = process.argv.slice(2);
const [X0, Y0, X1, Y1, cellArg] = nums.map(Number);
const buf = fs.readFileSync(file);
const off = buf.readUInt32LE(10), W = buf.readInt32LE(18), H = buf.readInt32LE(22);
const stride = Math.ceil((W * 3) / 4) * 4;
const px = (x, y) => { const i = off + (H - 1 - y) * stride + x * 3; return [buf[i + 2], buf[i + 1], buf[i]]; };
const cls = ([r, g, b]) => {
  if (r < 80 && g < 80 && b < 80) return 'K';
  if (r > 190 && g < 120 && b < 100) return 'R';
  if (r > 215 && g > 170 && b > 120 && b < 215 && r - b > 30) return 'S';
  return '.';
};
let minx = 1e9, miny = 1e9, maxx = 0, maxy = 0;
for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) if (cls(px(x, y)) !== '.') {
  minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y);
}
// estimate cell size from run lengths of color changes along rows if not given
let cell = cellArg;
if (!cell) {
  const runs = {};
  for (let y = miny; y <= maxy; y += 3) { let prev = null, len = 0;
    for (let x = minx; x <= maxx; x++) { const c = cls(px(x, y)); if (c === prev) len++; else { if (prev && len > 4) runs[len] = (runs[len] || 0) + 1; prev = c; len = 1; } } }
  console.error('run lengths', Object.entries(runs).sort((a, b) => b[1] - a[1]).slice(0, 8));
  cell = 10;
}
const cols = Math.round((maxx - minx + 1) / cell), rows = Math.round((maxy - miny + 1) / cell);
console.error(`bbox ${minx},${miny}-${maxx},${maxy} cell ${cell} grid ${cols}x${rows}`);
const cw = (maxx - minx + 1) / cols, ch = (maxy - miny + 1) / rows;
const out = [];
for (let r = 0; r < rows; r++) { let line = '';
  for (let c = 0; c < cols; c++) {
    // majority vote over the inner area of the cell
    const votes = {};
    for (let dy = 0.3; dy <= 0.7; dy += 0.2) for (let dx = 0.3; dx <= 0.7; dx += 0.2) {
      const k = cls(px(Math.floor(minx + (c + dx) * cw), Math.floor(miny + (r + dy) * ch))); votes[k] = (votes[k] || 0) + 1; }
    line += Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0];
  }
  out.push(line);
}
console.log(JSON.stringify(out, null, 0).replace(/","/g, '",\n"'));
