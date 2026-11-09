import { parseSetSource } from './model.js';
import { planAffectedSources } from './inventory.js';
import { applyOperation } from './operations.js';

/** Explicit opt-in demo. All content and writes stay in memory. */
export default async function demoSdk(insert, { seedRecovery = false } = {}) {
  const context = {
    org: 'adobedrago', repo: 'etrade', path: '/home', view: 'edit',
  };
  const setPath = '/disclosures/sets/homepage.json';
  const fragments = '/disclosures/fragments';
  const source = new Map([
    ['/home.html', `<body><main><div><div class="hero">
      <p>Open a brokerage account<sup>offer</sup>.</p>
      <p>Trading costs and rate terms<sup>fees,apy</sup>.</p>
      <p>Repeated offer reference<sup>offer</sup>.</p>
      <p>A reference needing review<sup>missing</sup>.</p>
      </div>
      <div class="fragment"><div><div><a href="/copy/shared-offer">Shared offer</a></div></div></div>
      <div class="metadata"><div><div>Disclosures</div><div>${setPath}</div></div></div>
      </div></main></body>`],
    ['/drafts/offer.html', `<body><main><p>Another offer<sup>offer</sup>.</p><div class="fragment"><div><div><a href="/copy/shared-offer">Shared offer</a></div></div></div><div class="metadata"><div><div>Disclosures</div><div>${setPath}</div></div></div></main></body>`],
    ['/copy/shared-offer.html', '<body><main><p>Shared fee information<sup>fees</sup>.</p></main></body>'],
    [setPath, JSON.stringify({
      id: 'homepage',
      introduction: [{ fragment: `${fragments}/introduction`, kind: 'notice' }],
      disclosures: [
        { disclosureId: 'offer', fragment: `${fragments}/brokerage-offer` },
        { disclosureId: 'fees', fragment: `${fragments}/trading-fees` },
        { disclosureId: 'apy', fragment: `${fragments}/savings-rate` },
        { disclosureId: 'risk', fragment: `${fragments}/investment-risk` },
      ],
      closing: [{ fragment: `${fragments}/closing` }],
    })],
  ]);
  [
    ['brokerage-offer', 'Account offer', 'Illustrative offer terms appear here. Open the source document to edit the approved wording.'],
    ['trading-fees', 'Trading fees', 'Illustrative fee information appears here, including any applicable qualifications.'],
    ['savings-rate', 'Savings rate terms', 'Illustrative rate qualifications and effective dates appear here.'],
    ['investment-risk', 'Investment risk', 'Illustrative investment risk information appears here.'],
    ['introduction', 'Important information', 'This is a sample footer for authoring practice.'],
    ['closing', 'Additional information', 'Sample closing information. No approved disclosure content is changed in this demo.'],
  ].forEach(([name, title, text]) => {
    source.set(`${fragments}/${name}.html`, `<body><main><div><p><strong>${title}</strong></p><p>${text}</p></div></main></body>`);
  });
  let contentWrites = 0;
  let firstWrite;
  let failAt = seedRecovery ? 2 : 0;
  const subscribers = new Set();
  let selectedHTML = '<sup>3</sup>';
  let demoStep = 0;
  const snapshot = () => {
    const doc = new DOMParser().parseFromString(source.get('/home.html'), 'text/html');
    doc.querySelector('.hero')?.setAttribute('data-block-index', '0');
    return { html: doc.body.outerHTML, editable: true, selection: { blockIndex: 0 } };
  };
  const emit = () => subscribers.forEach((callback) => callback(snapshot()));
  const sdk = {
    context,
    capabilities: { sendHTMLReplace: 1 },
    actions: {
      sendHTML: async (html, options = {}) => {
        if (!options.replace) { insert(html); return undefined; }
        const current = snapshot();
        if (options.expected?.html !== current.html || options.expected?.blockIndex !== 0) {
          return { ok: false, error: 'document-changed' };
        }
        const doc = new DOMParser().parseFromString(source.get('/home.html'), 'text/html');
        const next = new DOMParser().parseFromString(html, 'text/html').querySelector('[data-block-index="0"]');
        if (!next) return { ok: false, error: 'invalid-block' };
        next.removeAttribute('data-block-index');
        doc.querySelector('.hero').replaceWith(next);
        source.set('/home.html', doc.body.outerHTML);
        selectedHTML = [...next.querySelectorAll('sup')].at(-1)?.outerHTML || '';
        emit();
        const updated = snapshot();
        return { ok: true, html: updated.html, selection: updated.selection };
      },
      subscribeLiveDocument: (callback) => {
        subscribers.add(callback);
        callback(snapshot());
        return () => subscribers.delete(callback);
      },
      getSelection: async () => selectedHTML,
      saveDocument: async () => ({ ok: true }),
      daFetch: async (url, options = {}) => {
        const { pathname } = new URL(url);
        if (pathname.startsWith('/list/adobedrago/etrade')) {
          const folder = pathname.slice('/list/adobedrago/etrade'.length);
          const listing = new Map();
          [...source.keys()].forEach((path) => {
            if (!path.startsWith(`${folder}/`)) return;
            const relative = path.slice(folder.length + 1);
            const [name] = relative.split('/');
            if (relative.includes('/')) listing.set(name, { path: `/adobedrago/etrade${folder}/${name}` });
            else listing.set(name, { path: `/adobedrago/etrade${path}`, ext: path.endsWith('.json') ? 'json' : 'html' });
          });
          return Response.json([...listing.values()]);
        }
        const path = pathname.replace('/source/adobedrago/etrade', '');
        if (options.method === 'POST') {
          if (!path.startsWith('/.da/')) {
            contentWrites += 1;
            firstWrite ||= path;
            if (contentWrites === failAt) {
              source.set(firstWrite, `${source.get(firstWrite)}<!-- A collaborator changed this demo source. -->`);
              return new Response('', { status: 500 });
            }
          }
          source.set(path, await options.body.get('data').text());
          if (path === '/home.html') emit();
          return new Response('', { status: 200 });
        }
        return new Response(source.get(path) || '', { status: source.has(path) ? 200 : 404 });
      },
    },
    demo: {
      addSuperscript: () => {
        const number = demoStep === 0 ? '3' : '27';
        demoStep += 1;
        const doc = new DOMParser().parseFromString(source.get('/home.html'), 'text/html');
        const paragraph = doc.createElement('p');
        paragraph.innerHTML = `New illustrative claim<sup>${number}</sup>.`;
        doc.querySelector('.hero').append(paragraph);
        source.set('/home.html', doc.body.outerHTML);
        selectedHTML = `<sup>${number}</sup>`;
        emit();
      },
    },
  };
  if (seedRecovery) {
    const model = parseSetSource(source.get(setPath), setPath);
    const plan = await planAffectedSources(context, model, [1, 0, 2, 3], sdk.actions.daFetch);
    await applyOperation(context, plan, sdk.actions.daFetch);
    failAt = 0;
  }
  return sdk;
}
