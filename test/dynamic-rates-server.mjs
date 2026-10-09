/* eslint-env node */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const port = Number(process.env.RATE_DEMO_PORT || 3020);
const previewOrigin = new URL(process.env.AEM_LOCAL_ORIGIN || 'http://127.0.0.1:3000');
if (previewOrigin.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(previewOrigin.hostname)) {
  throw new Error('AEM_LOCAL_ORIGIN must be your local HTTP preview server.');
}
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};
const server = createServer(async (request, response) => {
  const { pathname, search } = new URL(request.url, 'http://localhost');
  let path;
  try {
    const decoded = decodeURIComponent(pathname);
    if (decoded.split('/').some((part) => part.startsWith('.'))) {
      response.writeHead(404).end();
      return;
    }
    path = resolve(root, `.${decoded}`);
  } catch {
    response.writeHead(400).end();
    return;
  }
  if (path !== root && !path.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end();
    return;
  }
  if (pathname === '/test/fixtures/unavailable') {
    response.writeHead(503, { 'Content-Type': 'application/json' }).end('{"error":"Demo failure"}');
    return;
  }
  if (pathname === '/test/fixtures/invalid-json') {
    response.writeHead(200, { 'Content-Type': 'application/json' }).end('Invalid sample JSON');
    return;
  }
  if (pathname === '/test/fixtures/timeout') {
    const timer = setTimeout(() => {
      response.writeHead(200, { 'Content-Type': 'application/json' }).end('{}');
    }, 6500);
    response.on('close', () => clearTimeout(timer));
    return;
  }
  if (pathname === '/test/fixtures/bank-rates-aggregate.json') {
    let body = '';
    // eslint-disable-next-line no-restricted-syntax
    for await (const chunk of request) body += chunk;
    const expected = '[{"id":"0","api_id":"webapipros","method":"GET","path":"/phx/apicontent/init/bankRates","body":""}]';
    if (request.method !== 'POST' || body !== expected || request.headers['content-type'] !== 'application/json') {
      response.writeHead(400).end('Invalid demo aggregate request.');
      return;
    }
  } else if (request.method !== 'GET') {
    response.writeHead(405).end();
    return;
  }
  try {
    const content = await readFile(path);
    response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(content);
  } catch {
    // Read-only local bridge: authored content from AEM; sample data stays local.
    // Missing docs/tests must not fall through to remotely previewed content.
    if (pathname.startsWith('/docs/') || pathname.startsWith('/test/') || pathname.includes('/.')) {
      response.writeHead(404).end();
      return;
    }
    try {
      const upstream = await fetch(new URL(`${pathname}${search}`, previewOrigin), {
        credentials: 'omit', redirect: 'manual', signal: AbortSignal.timeout(10000),
      });
      if (upstream.status >= 300 && upstream.status < 400) {
        response.writeHead(502, { 'Content-Type': 'text/plain' }).end('The local preview redirected. Open the final preview path directly.');
        return;
      }
      const contentType = upstream.headers.get('content-type') || 'text/html';
      let content;
      if (contentType.includes('text/html')) {
        content = await upstream.text();
        if (upstream.ok && !pathname.endsWith('.plain.html')) {
          const nonce = content.match(/<script[^>]*\snonce="([^"]+)"/i)?.[1];
          const nonceAttribute = nonce ? ` nonce="${nonce}"` : '';
          const inspector = `<script${nonceAttribute} type="module" src="/docs/dynamic-rates-inspector.js"></script>`;
          content = content.replace(/<\/body>/i, `${inspector}</body>`);
        }
      } else {
        content = Buffer.from(await upstream.arrayBuffer());
      }
      response.writeHead(upstream.status, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
      response.end(content);
    } catch {
      response.writeHead(502, { 'Content-Type': 'text/plain' }).end('Start your local AEM server on port 3000, then reload this authored-page test.');
    }
  }
});
server.listen(port, '127.0.0.1', () => {
  // eslint-disable-next-line no-console
  console.log(`Rate demo: http://127.0.0.1:${port}/docs/dynamic-rates-demo.html`);
});
