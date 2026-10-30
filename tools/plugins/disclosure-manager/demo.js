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
