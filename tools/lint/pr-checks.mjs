import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export default function previewIssues(body, branch) {
  const slug = branch.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const hostname = `${slug}--etrade--adobedrago.aem.page`;
  const links = (body || '').match(/https?:\/\/[^\s"')\]]+/g) || [];
  const valid = links.some((link) => {
    try {
      // Trim Markdown autolink wrapping, while retaining literal /<path> placeholders.
      const candidate = link.endsWith('>') && !link.includes('<') ? link.slice(0, -1) : link;
      const url = new URL(candidate);
      return url.protocol === 'https:' && url.hostname === hostname
        && !url.username && !url.password && !url.port
        && !/%3[ce]/i.test(url.pathname);
    } catch {
      return false;
    }
  });
  return valid ? [] : [`PR description requires a branch preview URL: https://${hostname}/home`];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  if (!event.pull_request) throw new Error('This check requires a pull request event.');
  const issues = previewIssues(event.pull_request.body, event.pull_request.head.ref);
  if (issues.length) {
    process.stderr.write(`${issues.join('\n')}\n`);
    process.exitCode = 1;
  }
}
