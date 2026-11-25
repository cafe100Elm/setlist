// Test-only web server: serves the real app folder, but swaps in a config that
// points at the pretend cloud (Firebase emulators) on this computer, so two made-up
// people can be signed in at once (http://localhost:8819 and http://127.0.0.1:8819).
// Run: node firebase/test/serve.mjs "$PWD"      See CLAUDE.md → "Testing following".
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = process.argv[2];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  if (p === '/js/firebase-config.js') { res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' }); res.end("export default { apiKey: 'demo', authDomain: 'demo-setlist.firebaseapp.com', projectId: 'demo-setlist', emulator: true };\n"); return; }
  if (p === '/sw.js') { res.writeHead(404); res.end(); return; } // no offline helper in tests: always fresh files
  const f = path.join(root, p);
  if (!f.startsWith(root) || p.includes('/reference/')) { res.writeHead(403); res.end(); return; }
  fs.readFile(f, (e, buf) => { if (e) { res.writeHead(404); res.end('not found'); return; } res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(buf); });
}).listen(8819, '127.0.0.1', () => console.log('test app on 8819'));
