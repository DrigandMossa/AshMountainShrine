import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'fs'; import http from 'http'; import path from 'path';
const root = process.cwd(); const types = { '.html': 'text/html', '.js': 'text/javascript' };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(8766);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage(); await page.goto('http://localhost:8766/page.html'); await page.waitForFunction(() => window.ready);
const jobs = JSON.parse(process.argv[2]);
for (const [file, id, opts, name] of jobs) {
  const b = fs.readFileSync(`out/${id}.vrm`).toString('base64');
  const { shots } = await page.evaluate(([b, o]) => window.renderVRM(b, o.views || [0], o), [b, opts]);
  fs.writeFileSync(`out/${name}.png`, Buffer.from(shots[0].split(',')[1], 'base64'));
}
await browser.close(); srv.close();
