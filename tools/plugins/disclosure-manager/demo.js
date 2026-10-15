/** Explicit opt-in demo. All content and writes stay in memory. */
export default function demoSdk(insert) {
  const context = {
    org: 'adobedrago', repo: 'etrade', path: '/home', view: 'edit',
  };
  const setPath = '/disclosures/sets/homepage.json';
  const fragments = '/disclosures/fragments';
  const source = new Map([
    ['/home.html', `<body><main><div>
      <p>Open a brokerage account<sup>offer</sup>.</p>
      <p>Trading costs and rate terms<sup>fees,apy</sup>.</p>
      <p>Repeated offer reference<sup>offer</sup>.</p>
      <p>A reference needing review<sup>missing</sup>.</p>
      <div class="metadata"><div><div>Disclosures</div><div>${setPath}</div></div></div>
      </div></main></body>`],
    [setPath, JSON.stringify({
      id: 'homepage',
      disclosures: [
        { disclosureId: 'offer', fragment: `${fragments}/brokerage-offer` },
        { disclosureId: 'fees', fragment: `${fragments}/trading-fees` },
        { disclosureId: 'apy', fragment: `${fragments}/savings-rate` },
        { disclosureId: 'risk', fragment: `${fragments}/investment-risk` },
      ],
    })],
  ]);
  ['brokerage-offer', 'trading-fees', 'savings-rate', 'investment-risk'].forEach((name) => {
    source.set(`${fragments}/${name}.html`, `<body><main><div><p>Demo ${name} disclosure.</p></div></main></body>`);
  });
  return {
    context,
    actions: {
      sendHTML: insert,
      daFetch: async (url, options = {}) => {
        const path = new URL(url).pathname.replace('/source/adobedrago/etrade', '');
        if (options.method === 'POST') {
          source.set(path, await options.body.get('data').text());
          return new Response('', { status: 200 });
        }
        return new Response(source.get(path) || '', { status: source.has(path) ? 200 : 404 });
      },
    },
  };
}
