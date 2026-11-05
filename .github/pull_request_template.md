Use a Conventional Commit title, for example `fix(header): preserve keyboard focus`.

Describe the problem, resulting behavior and relevant validation. Link the [GitHub issue(s)](../issues).

Fix #<gh-issue-id>

Test URLs:
- Before: https://develop--etrade--AdobeDrago.aem.page/home
- After: https://<branch>--etrade--AdobeDrago.aem.page/<path>

Replace the placeholders with the actual branch preview and affected page. For a branch like `codex/my-change`, use `codex-my-change` in the hostname. CI requires a matching `.aem.page` URL.

Validation:
- `npm run check`
- Browser checks for affected layouts, keyboard navigation and enlarged text
