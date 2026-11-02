/* eslint-env node */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

// Optional fixture maintenance, never a site build step. No vendor code is copied.
const profileURL = new URL('../scripts/demo-performance-profile.json', import.meta.url);
const profile = JSON.parse(await readFile(profileURL));
const directory = new URL('../scripts/demo-performance-assets/', import.meta.url);
await mkdir(directory, { recursive: true });

function payload(size, randomLength) {
  let seed = 17;
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const prefix = '// Inert performance fixture. No vendor code or tracking.\nexport default [\n';
  const suffix = '\n];\n';
  let body = prefix;
  let remaining = size - prefix.length - suffix.length;
  let index = 0;
  while (remaining >= 6) {
    const length = Math.min(96, remaining - 6);
    let value = '';
    for (let i = 0; i < length; i += 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; // eslint-disable-line no-bitwise
      value += index < randomLength ? alphabet[seed % alphabet.length] : alphabet[index % 62];
      index += 1;
    }
    body += `  '${value}',\n`;
    remaining -= length + 6;
  }
  return body + ' '.repeat(remaining) + suffix;
}

// Match decoded bytes exactly and local gzip size within roughly 0.5%.
// Hosting may use another compression format; capture actual Resource Timing in the demo.
for (const resource of profile.resources) { // eslint-disable-line no-restricted-syntax
  let low = 0;
  let high = resource.decodedBytes;
  let closest;
  let distance = Infinity;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const source = payload(resource.decodedBytes, middle);
    const compressed = gzipSync(source).length;
    const difference = Math.abs(compressed - resource.gzipBytes);
    if (difference < distance) { closest = source; distance = difference; }
    if (compressed < resource.gzipBytes) low = middle + 1;
    else high = middle - 1;
  }
  await writeFile(new URL(`${resource.id}.js`, directory), closest); // eslint-disable-line no-await-in-loop
  resource.fixtureGzipBytes = gzipSync(closest).length;
}
await writeFile(profileURL, `${JSON.stringify(profile, null, 2)}\n`);
