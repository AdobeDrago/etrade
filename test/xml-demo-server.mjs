/* eslint-env node */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const base = new URL('../tools/plugins/xml-tools/', import.meta.url);
const prefix = '/tools/plugins/xml-tools/';
const files = ['xml-tools.html', 'xml-tools.css', 'xml-tools.js', 'controller.js', 'model.js', 'page-xml.js'];
const types = { html: 'text/html', css: 'text/css', js: 'text/javascript' };
const port = Number(process.env.XML_DEMO_PORT || 3031);
createServer(async (request, response) => {
  const { pathname } = new URL(request.url, 'http://localhost');
  if (pathname === '/') {
    response.writeHead(302, { Location: `${prefix}xml-tools.html?demo=1` }).end();
    return;
  }
  const name = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : '';
  if (request.method !== 'GET' || !files.includes(name)) {
    response.writeHead(404).end();
    return;
  }
  try {
    const content = await readFile(fileURLToPath(new URL(name, base)));
    response.writeHead(200, { 'Content-Type': `${types[name.split('.').pop()]};charset=utf-8`, 'Cache-Control': 'no-store' }).end(content);
  } catch {
    response.writeHead(500).end('Could not read the demo files.');
  }
}).listen(port, '127.0.0.1', () => {
  process.stdout.write(`XML Tools: http://localhost:${port}${prefix}xml-tools.html?demo=1\n`);
});
