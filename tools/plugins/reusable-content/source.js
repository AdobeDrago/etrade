import { cardRecord, siteContext, validPath } from './model.js';

function directoryEntries(path, items) {
  return items.flatMap((item) => {
    const name = item.name?.replace(/\/$/, '');
    if (!name || name.startsWith('.')) return [];
    const folder = item['content-type'] === 'application/folder'
      || item.name.endsWith('/') || (!item['content-type'] && !item.ext && !name.includes('.'));
    const filename = item.ext && !name.endsWith(`.${item.ext}`) ? `${name}.${item.ext}` : name;
    const fullPath = `${path}/${folder ? name : filename}`;
    if (name.includes('/') || !validPath(fullPath)) return [];
    if (folder) return [{ path: fullPath, folder }];
    return fullPath.endsWith('.html') ? [{ path: fullPath.slice(0, -5), folder }] : [];
  });
}

export function createDirectory(context, daFetch, daToken) {
  const { org, repo } = siteContext(context);
  const aem = `https://api.aem.live/${org}/sites/${repo}/source`;
  const da = `https://admin.da.live/list/${org}/${repo}`;
  const cache = new Map();
  let nextStart = 0;

  async function page(path, modern, token) {
    if (modern) {
      const now = Date.now();
      const start = Math.max(now, nextStart);
      nextStart = start + 130;
      if (start > now) await new Promise((resolve) => { setTimeout(resolve, start - now); });
    }
    const headers = token ? { 'da-continuation-token': token } : {};
    // DA's extension SDK adds Authorization. The AEM source bus also needs this header.
    if (modern && daToken) headers['x-content-source-authorization'] = `Bearer ${daToken}`;
    const response = await daFetch(modern ? `${aem}${path}/` : `${da}${path}`, {
      headers,
      signal: AbortSignal.timeout(10000),
      ...(modern ? { redirect: 'error', referrerPolicy: 'unsafe-url' } : {}),
    });
    if (!response.ok) return { status: response.status };
    const items = await response.json();
    if (!Array.isArray(items)) throw new Error('DA returned an invalid file list.');
    return { items, token: response.headers.get('da-continuation-token') };
  }

  async function remaining(path, modern, first) {
    if (!first.items) {
      if (first.status === 404 && path) return [];
      throw new Error('Could not list DA sources. Check your access and retry.');
    }
    const items = [...first.items];
    const tokens = new Set();
    let { token } = first;
    while (token) {
      if (tokens.has(token)) throw new Error('DA returned a repeated file list page.');
      tokens.add(token);
      // eslint-disable-next-line no-await-in-loop -- DA supplies the next token in each response.
      const more = await page(path, modern, token);
      if (!more.items) throw new Error('Could not finish listing DA sources.');
      items.push(...more.items);
      token = more.token;
    }
    return directoryEntries(path, items);
  }

  async function backend() {
    const current = await page('', true).catch(() => ({}));
    if (current.items) return { modern: true, root: current };
    return { modern: false, root: await page('', false) };
  }

  let connection;
  return (path) => {
    connection ??= backend().catch((error) => { connection = undefined; throw error; });
    if (!cache.has(path)) {
      const pending = connection.then(async ({ modern, root }) => {
        const first = path ? await page(path, modern) : root;
        return remaining(path, modern, first);
      }).catch((error) => {
        cache.delete(path);
        connection = undefined;
        throw error;
      });
      cache.set(path, pending);
    }
    return cache.get(path);
  };
}

async function fragmentRoots(list) {
  const roots = [];
  async function scan(path, depth) {
    const entries = await list(path);
    await Promise.all(entries.filter(({ folder }) => folder).map(({ path: child }) => {
      if (child.endsWith('/fragments')) roots.push(child);
      else if (depth < 2 && !child.endsWith('/drafts')) return scan(child, depth + 1);
      return undefined;
    }));
  }
  await scan('', 0);
  return roots;
}

export async function catalogFiles(list, kind) {
  const paths = new Set();
  const seen = new Set();
  async function walk(path) {
    if (seen.has(path)) return;
    seen.add(path);
    const entries = await list(path);
    await Promise.all(entries.map((entry) => {
      if (entry.folder) return walk(entry.path);
      paths.add(entry.path);
      return undefined;
    }));
  }
  const roots = kind === 'card' ? ['/cards'] : await fragmentRoots(list);
  await Promise.all(roots.map(walk));
  return [...paths].sort((a, b) => a.localeCompare(b));
}

export async function previewCard(context, path, fetchCard, signal) {
  const { org, repo } = siteContext(context);
  const url = `https://da-sc.adobeaem.workers.dev/preview/${org}/${repo}${path}`;
  const response = await fetchCard(url, { signal, credentials: 'omit' });
  if (!response.ok) throw new Error('Card preview is unavailable. Preview the source in DA and try again.');
  return cardRecord(path, await response.json());
}
