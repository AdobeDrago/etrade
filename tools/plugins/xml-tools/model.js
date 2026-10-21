export const SCHEMA_NAME = 'xml-product-demo';
export const DEMO_FOLDER = '/xml-demo/products/';
export const MAX_XML_BYTES = 250000;
export const FIELDS = ['id', 'name', 'rate', 'effectiveDate', 'disclosure'];
export const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<product>
  <id>sample-cash</id>
  <name>Sample cash account</name>
  <rate>4.10%</rate>
  <effectiveDate>2026-10-21</effectiveDate>
  <disclosure>Illustrative demo data only. Not an offer.</disclosure>
</product>
`;

export const SCHEMA = {
  title: 'XML product demo',
  type: 'object',
  required: FIELDS,
  additionalProperties: false,
  properties: {
    id: { type: 'string', title: 'Product ID', pattern: '^[a-z][a-z0-9-]{0,79}$' },
    name: { type: 'string', title: 'Product name', minLength: 1 },
    rate: { type: 'string', title: 'Display rate', minLength: 1 },
    effectiveDate: { type: 'string', title: 'Effective date', format: 'date' },
    disclosure: { type: 'string', title: 'Disclosure', minLength: 1 },
  },
};

export function escapeMarkup(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[char]));
}

export function validateProduct(input) {
  const product = {};
  FIELDS.forEach((key) => {
    const value = input[key];
    if (typeof value !== 'string' || !value.trim()) throw new Error(`Enter ${SCHEMA.properties[key].title.toLowerCase()}.`);
    product[key] = value.trim();
    // XML 1.0 permits only these characters, including paired surrogate code points.
    const invalid = Array.from(product[key]).some((char) => {
      const cp = char.codePointAt(0);
      return !(cp === 9 || cp === 10 || cp === 13 || (cp >= 32 && cp <= 0xd7ff)
        || (cp >= 0xe000 && cp <= 0xfffd) || (cp >= 0x10000 && cp <= 0x10ffff));
    });
    if (invalid) throw new Error('Remove unsupported XML characters.');
    if (product[key].length > 10000) throw new Error('Each field must be under 10,000 characters.');
  });
  if (!/^[a-z][a-z0-9-]{0,79}$/.test(product.id)) throw new Error('Product ID must start with a lowercase letter and contain only lowercase letters, digits, or hyphens (up to 80 characters).');
  const date = new Date(`${product.effectiveDate}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(product.effectiveDate) || Number.isNaN(date.valueOf())
    || date.toISOString().slice(0, 10) !== product.effectiveDate) throw new Error('Enter a valid effective date (YYYY-MM-DD).');
  return product;
}

export function parseProductXml(xml) {
  if (typeof xml !== 'string' || !xml.trim()) throw new Error('Paste XML or choose Try sample.');
  if (new Blob([xml]).size > MAX_XML_BYTES) throw new Error('Choose an XML file smaller than 250 KB.');
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('DTD and entity declarations are not supported.');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length || doc.getElementsByTagNameNS('*', 'parsererror').length) {
    throw new Error('The XML is malformed. Check the opening and closing tags.');
  }
  const root = doc.documentElement;
  if (!root || root.tagName !== 'product' || root.attributes.length) throw new Error('Use a <product> root without attributes or namespaces. Choose Try sample for the supported format.');
  const product = {};
  Array.from(root.childNodes).forEach((node) => {
    if (node.nodeType === 3 && node.textContent.trim()) throw new Error('Place all product text inside named fields.');
  });
  Array.from(root.children).forEach((field) => {
    const key = field.tagName;
    if (!FIELDS.includes(key) || Object.hasOwn(product, key)) throw new Error(`Unsupported or repeated field: ${key}. Use the sample XML format.`);
    if (field.attributes.length || field.children.length) throw new Error(`Use plain text inside <${key}> without attributes or nested elements.`);
    product[key] = field.textContent;
  });
  return validateProduct(product);
}

export function productXml(input) {
  const product = validateProduct(input);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<product>\n${FIELDS.map((key) => `  <${key}>${escapeMarkup(product[key])}</${key}>`).join('\n')}\n</product>\n`;
}

const row = (key, value) => `<div><div><h3 id="${key}">${key}</h3></div><div><p>${escapeMarkup(value)}</p></div></div>`;

export function productSource(input) {
  const product = validateProduct(input);
  return `<body><header></header><main><div><div class="da-form">${row('title', product.name)}${row('x-schema-name', SCHEMA_NAME)}</div><div class="${SCHEMA_NAME}">${FIELDS.map((key) => row(key, product[key])).join('')}</div></div></main><footer></footer></body>`;
}

function readRows(block) {
  return Object.fromEntries(Array.from(block?.children || [])
    .filter((item) => item.children.length === 2)
    .map((item) => [item.children[0].textContent.trim(), item.children[1].textContent.trim()]));
}

export function productFromSource(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const metadata = readRows(doc.querySelector('main > div > .da-form'));
  if (metadata['x-schema-name'] !== SCHEMA_NAME) throw new Error('This document does not use the XML product demo schema.');
  return validateProduct(readRows(doc.querySelector(`main > div > .${SCHEMA_NAME}`)));
}

export function demoPath(path) {
  if (typeof path !== 'string' || !/^\/xml-demo\/products\/[a-z][a-z0-9-]{0,79}$/.test(path)) {
    throw new Error(`Use ${DEMO_FOLDER} followed by a lowercase document name, without an extension.`);
  }
  return path;
}

function sourceUrl(context, path) {
  if (![context?.org, context?.repo].every((part) => typeof part === 'string' && /^[a-z0-9-]+$/i.test(part))) {
    throw new Error('Open XML Tools from the DA Library to connect to your site.');
  }
  return `https://admin.da.live/source/${context.org}/${context.repo}${path}.html`;
}

async function getSource(context, path, request) {
  const response = await request(`${sourceUrl(context, path)}?nocache=${Date.now()}`, { cache: 'no-store' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Could not read DA content (${response.status}). Check your access and try again.`);
  return response.text();
}

async function postSource(context, path, html, request) {
  const body = new FormData();
  body.append('data', new Blob([html], { type: 'text/html' }), 'document.html');
  const response = await request(sourceUrl(context, path), { method: 'POST', body });
  if (!response.ok) throw new Error(`Could not save in DA (${response.status}). Check your access and try again.`);
}

export async function loadProduct(context, path, request) {
  demoPath(path);
  const source = await getSource(context, path, request);
  if (source === null) throw new Error('This demo document has not been saved yet.');
  return { product: productFromSource(source), source, path };
}

export async function saveProduct(context, path, input, request, snapshot) {
  demoPath(path);
  const html = productSource(input);
  const latest = await getSource(context, path, request);
  if (latest !== null && (!snapshot || snapshot.path !== path || snapshot.source !== latest)) {
    throw new Error('This document already exists or changed in DA. Load saved content before updating it, or choose a new document name.');
  }
  if (snapshot?.path === path && latest === null) throw new Error('This document was removed in DA. Choose a new document name.');
  const schemaPath = `/.da/forms/schemas/${SCHEMA_NAME}`;
  const schemaSource = await getSource(context, schemaPath, request);
  if (schemaSource === null) {
    const markup = `<body><main><div><pre><code>${escapeMarkup(JSON.stringify(SCHEMA, null, 2))}</code></pre></div></main></body>`;
    await postSource(context, schemaPath, markup, request);
  } else {
    const doc = new DOMParser().parseFromString(schemaSource, 'text/html');
    let existing;
    try { existing = JSON.parse(doc.querySelector('code')?.textContent || ''); } catch { /* Report below. */ }
    if (JSON.stringify(existing) !== JSON.stringify(SCHEMA)) throw new Error('The demo schema in DA differs from this tool. Review it in the Schema Editor before continuing.');
  }
  await postSource(context, path, html, request);
  return { product: validateProduct(input), source: html, path };
}
