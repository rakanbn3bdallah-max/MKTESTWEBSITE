// Local test server for the Vercel version of the site: serves site/ as static files and runs site/api/*.js
// like Vercel does. Uses an in-memory account store unless KV_REST_API_URL/KV_REST_API_TOKEN are set.
// Usage: node tools/dev_server.js [port]   then open http://localhost:3000
const http = require('http'), fs = require('fs'), path = require('path');
if (!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) process.env.RW_MEMORY_DB = '1';
const site = path.resolve(__dirname, '..', 'site');
const port = +process.argv[2] || 3000;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const m = url.pathname.match(/^\/api\/([a-z]+)$/);
  if (m) {
    const file = path.join(site, 'api', m[1] + '.js');
    if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('Not found'); }
    let raw = ''; for await (const c of req) raw += c;
    try { req.body = raw && /json/.test(req.headers['content-type'] || '') ? JSON.parse(raw) : raw; } catch (e) { req.body = {}; }
    return require(file)(req, res);
  }
  let p = path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  if (!p || p.endsWith(path.sep)) p = path.join(p, 'index.html');
  const full = path.join(site, p);
  if (!full.startsWith(site) || full.includes(path.sep + 'api' + path.sep) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) { res.statusCode = 404; return res.end('Not found'); }
  res.setHeader('Content-Type', TYPES[path.extname(full)] || 'application/octet-stream');
  fs.createReadStream(full).pipe(res);
}).listen(port, () => console.log(`http://localhost:${port} (${process.env.RW_MEMORY_DB ? 'in-memory accounts' : 'Upstash Redis'})`));
