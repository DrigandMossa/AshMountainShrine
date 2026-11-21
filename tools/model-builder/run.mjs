import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'fs';
import http from 'http';
import path from 'path';
const root = process.cwd(), outDir = process.argv[2], only = process.argv[3] ? process.argv[3].split(',') : null;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript' };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(8765);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto('http://localhost:8765/page.html'); await page.waitForFunction(() => window.ready, null, { timeout: 30000 });
fs.mkdirSync(outDir, { recursive: true });
const vrms = await page.evaluate(o => window.buildAll(o), only);
for (const [id, b] of Object.entries(vrms)) {
  fs.writeFileSync(`${outDir}/${id}.vrm`, Buffer.from(b, 'base64'));
  const { info, shots } = await page.evaluate(([b, o]) => window.renderVRM(b, [0, 0.75, Math.PI], o), [b, JSON.parse(process.env.OPTS || '{}')]);
  console.log(id, (Buffer.from(b, 'base64').length / 1024).toFixed(0) + 'KB', JSON.stringify(info));
  shots.forEach((s, i) => fs.writeFileSync(`${outDir}/${id}_${['front', 'side', 'back'][i]}.png`, Buffer.from(s.split(',')[1], 'base64')));
}
await browser.close(); srv.close();
