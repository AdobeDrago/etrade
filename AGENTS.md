# AGENTS.md

Edge Delivery Services. Read a block first. Omissions are in the repo or known.

## Avoid
- `scripts/aem.js` is vendored. Never edit.
- Markup comes from the backend. `curl localhost:3000/x.plain.html` first.
- `buildAutoBlocks` rewrites content before your block runs.
- Authors omit and add cells. Decorate defensively.
- No build step; devDependencies only.
- Scope CSS to `.blockname`; `-wrapper`/`-container` are section classes.
- `fragment/fragment.js` is the only cross-block import. Otherwise use `/scripts/`.

## Checks and commits

- Use Node.js 24+ and `npm ci` to install development tools and Husky hooks. Verify the hook files exist and `git config --get core.hooksPath` returns `.husky/_` before committing.
- `pre-commit` checks staged code; `commit-msg` validates the new message. Hooks do not revalidate existing commit history.
- Commit messages and PR titles use Conventional Commits, e.g. `fix(privacy): open cookie preferences`. Scope is optional; the full header must fit within 100 characters.
- Before pushing, run `npm run check` and `npm run commitlint -- --from <pr-base-ref> --to HEAD`. Use the actual PR base ref, e.g. `origin/develop`; recheck the full range after merging the base branch.
- Do not bypass failing local hooks with `--no-verify` or `HUSKY=0`. Repair missing hooks or fix the reported issue.
- CI also validates the PR title and branch preview URL. See [CONTRIBUTING.md](CONTRIBUTING.md) and [lint guardrails](docs/lint-guardrails.md) for the complete policy.

## Outdated
- `fstab.yaml`, `helix-query.yaml`, `paths.json` are retired. Config lives at tools.aem.live.

## Remember
- `npx -y @adobe/aem-cli up`: local code, previewed content.
- Merging `main` ships code; content publishes separately.
- A PR without a `{branch}--etrade--AdobeDrago.aem.page/{path}` link is rejected.
- All committed files are served. Use `.hlxignore`.
- Skills: `/plugin marketplace add adobe/skills`, then `aem-edge-delivery-services` (24 skills, incl. `docs-search`).
