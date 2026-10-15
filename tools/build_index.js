// Wraps site/page.html (artifact-style body content) into a standalone site/index.html for local use.
const fs = require('fs'), path = require('path');
const site = path.resolve(__dirname, '..', 'site');
const page = fs.readFileSync(path.join(site, 'page.html'), 'utf8');
const cut = page.indexOf('<a class="skip"');
const head = page.slice(0, cut), body = page.slice(cut);
const html = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<meta name="theme-color" content="#16120E">\n${head}</head>\n<body>\n${body}</body>\n</html>\n`;
fs.writeFileSync(path.join(site, 'index.html'), html);
// syntax-check the inline script
const js = page.slice(page.lastIndexOf('<script>') + 8, page.lastIndexOf('</script>'));
new Function(js);
console.log('index.html written, inline script parses OK');
