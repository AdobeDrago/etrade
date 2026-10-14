# Your Project's Title...
Your project's description...

## Environments
- Preview: https://main--etrade--AdobeDrago.aem.page/
- Live: https://main--etrade--AdobeDrago.aem.live/

## Documentation

Before using the aem-boilerplate, we recommand you to go through the documentation on https://www.aem.live/docs/ and more specifically:
1. [Developer Tutorial](https://www.aem.live/developer/tutorial)
2. [The Anatomy of a Project](https://www.aem.live/developer/anatomy-of-a-project)
3. [Web Performance](https://www.aem.live/developer/keeping-it-100)
4. [Markup, Sections, Blocks, and Auto Blocking](https://www.aem.live/developer/markup-sections-blocks)

## Installation

```sh
npm i
```

## Linting

```sh
npm run lint
```

## Local development

1. Create a new repository based on the `aem-boilerplate` template
1. Add the [AEM Code Sync GitHub App](https://github.com/apps/aem-code-sync) to the repository
1. Install the [AEM CLI](https://github.com/adobe/helix-cli): `npm install -g @adobe/aem-cli`
1. Start AEM Proxy: `aem up` (opens your browser at `http://localhost:3000`)
1. Open the `etrade` directory in your favorite IDE and start coding :)

## Current six-page authoring

The [authoring pack](docs/current-pages-authoring.html) provides copyable DA tables and rendered previews for Home, Welcome Back, Our Accounts, Brokerage, Planning and Why E*TRADE. It includes source assets, page-specific disclosure sets and fragments, and save/preview instructions. Content is prepared locally; DA save and preview are separate.

Run `npm run demo:rates` with the AEM proxy on port 3000, then open http://127.0.0.1:3020/docs/current-pages-authoring.html. This review renders page bodies and disclosures with the local blocks; verify the shared header/footer in the branch preview after saving content.

Add `&view=site` to a selected page's local review URL to include the shared header/footer and hide authoring controls. The prepared tables include floating docks for Home, Brokerage, Planning and Why E*TRADE.

Use the [authoring tools index](docs/index.html) for reusable rate examples, block examples, Investment Choices tables, footer content and homepage disclosures. Tests also use the page and block example data in `docs/`. The folder is excluded from Edge Delivery by `.hlxignore`.

Our Accounts checking uses a named API rate; the local authoring preview supplies sample JSON. Use the [dynamic-rate setup guide](docs/dynamic-rates-authoring.html) for bindings and live connection checks. Savings and CD promotions remain authored campaign terms. Update campaign claims and their disclosures together before publishing.
