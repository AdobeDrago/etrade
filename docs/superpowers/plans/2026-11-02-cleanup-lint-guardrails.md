# Cleanup and lint guardrails implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task.

**Goal:** Clean existing violations, then enforce the repository's JS, CSS, commit and preview conventions locally and in CI.

**Architecture:** Keep the current ESLint/Airbnb and Stylelint foundation. Add focused project rules and fast staged-file hooks; run full checks on pull requests. All new packages are development dependencies.

**Spec:** The cleanup-first scope agreed in this chat: migrate scalable measurements, preserve physical-pixel exceptions, cover tools/docs CSS, enforce imports/vendor protection and conventional commits, and validate branch preview URLs.

## Constraints

- Work on `codex/cleanup-lint-guardrails`, based on `develop`.
- Never modify `scripts/aem.js`; no build step or runtime dependencies.
- Retain current breakpoints, authored markup, behavior and default-size rendering.
- Only `fragment/fragment.js` may be imported across blocks.
- Shared palette/token definitions and standalone tools have different ownership from block styles.
- Tooling files must be excluded from EDS delivery using `.hlxignore`.
- Keep the ESLint major-version migration and hosted branch-protection settings separate.

## Review focus

- Unit checks must catch font shorthands and custom property fallbacks without flagging strings, URLs, percentages or legitimate borders.
- Block scope checks must inspect each selector and allow established wrapper/container integration and keyframes.
- Hooks must validate staged content, respect partial staging, and never rewrite vendored code.
- PR checks must handle branch names containing `/` and reject unrelated preview hosts/placeholders.
- Local and CI enforcement must use the same rules; configuration changes require a full lint.

## Task 1: Cleanup and CSS rules

- [x] Add behavioral tests that demonstrate unit, token and block-scope violations and valid exceptions.
- [x] Observe failures before adding project Stylelint plugins.
- [x] Migrate existing typography/spacing to rem or equivalent existing tokens and replace avoidable ID selectors.
- [x] Enable project rules and broaden CSS coverage to tools/docs; document necessary exceptions with reasons.
- [x] Verify full CSS lint and default/enlarged-text browser rendering where local fixtures are available.

## Task 2: JavaScript and repository checks

- [x] Add failing behavioral tests for forbidden cross-block imports, changed vendored files, conflict markers and invalid PR preview links.
- [x] Implement focused JS/project checks with staged and CI base-ref modes.
- [x] Fail on unused JS suppressions and warnings; keep needed suppressions narrowly scoped.
- [x] Verify rules using real input and disposable Git repositories, including partially staged files and deleted paths.

## Task 3: Hooks, CI and guidance

- [x] Configure Husky/lint-staged and commitlint; enforce the same policy in CI on push and pull_request.
- [x] Verify valid/invalid commits and staged-file checks in a disposable repository.
- [x] Update contribution guidance, PR template, editor indentation and delivery exclusions.
- [x] Run the full tests, lint and diff checks, then review the entire change.

## Decisions and evidence

- User chose existing-code cleanup followed by stronger enforcement.
- Baseline on 2026-11-02: 359 tests pass; `npm run lint` passes.
- Local AEM preview was not running at the start; served `/home.plain.html` could not be reached. No authored markup changes are planned.

## Final verification

- `npm run check` passes on Node 24.22.1: 374 tests, 0 failures; expanded JS/CSS/project lint passes.
- Browser comparisons: 10 mobile/desktop pairs across the handoff guide, three authoring tools and a visible library fixture retain default computed appearance; all remain within page width at 200% root text size. The disclosure toolbar now wraps when enlarged text needs more space.
- Review found and tests now cover nested module imports, font-shorthand/line-height units, literal preview placeholders, and deletion-only vendor changes. Each reported gap was reproduced before its fix; all resulting tests pass.
- `scripts/aem.js` is unchanged. Lockfile dependency and engine metadata match package.json.
- Dependency audit comparison: the original and updated lockfiles both report the same 9 existing findings (1 low, 2 moderate, 6 high); the added development tools introduce no additional reported package findings. Dependency remediation remains separate from the lint rollout.
- The local branch is retained for review; GitHub branch protection and the separate ESLint major upgrade remain outside this change. Browser checks use repository pages/fixtures and do not establish live DA-content acceptance.
