// Demo gateway: serves the exported web app AND forwards Firebase emulator
// traffic, all on one port, so a hosted preview (one HTTPS origin) works.
// Build with: EXPO_PUBLIC_USE_EMULATORS=1 EXPO_PUBLIC_EMULATOR_HOST=same-origin npx expo export -p web -o dist
// Run with:   node scripts/demo-gateway.cjs dist 8099
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || 'dist');
const port = Number(process.argv[3] || 8099);
const routes = [
  { prefix: '/google.firestore.', port: 8080 }, // Firestore (WebChannel / long polling)
  { prefix: '/v1/projects/', port: 8080 }, // Firestore REST (batchGet, commit)
  { prefix: '/identitytoolkit.googleapis.com', port: 9099 }, // Auth
  { prefix: '/securetoken.googleapis.com', port: 9099 },
  { prefix: '/emulator/', port: 9099 },
  { prefix: '/v0/b/', port: 9199 }, // Storage
  { prefix: '/b/', port: 9199 },
];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.wav': 'audio/wav', '.svg': 'image/svg+xml' };

http
  .createServer((req, res) => {
    const route = routes.find((r) => req.url.startsWith(r.prefix));
    if (route) {
      const upstream = http.request(
        { host: '127.0.0.1', port: route.port, path: req.url, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${route.port}` } },
        (up) => {
          res.writeHead(up.statusCode || 502, up.headers);
          up.pipe(res);
        },
      );
      upstream.on('error', () => {
        res.writeHead(502);
        res.end('emulator unavailable');
      });
      req.pipe(upstream);
      return;
    }
    const url = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(root, url);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, '0.0.0.0', () => console.log(`Together demo on http://localhost:${port}`));
