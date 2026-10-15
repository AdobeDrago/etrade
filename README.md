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

## Authoring and regression tests

Author content directly in DA using the table structures and variants documented in each block's README. Save, preview and publish content separately from code. Dynamic bank-rate settings are documented in [Cards Product](blocks/cards-product/README.md#optional-dynamic-rates); campaign claims and their disclosures must be updated together.

Page and block examples used by regression tests live in `test/fixtures/`. Run `npm run test:blocks` and `npm run test:rates` to check them. For browser rate checks, run `npm run demo:rates` with the AEM proxy on port 3000, then open http://127.0.0.1:3020/test/card-rates.html.

## Third-party performance demo

Open **Demo controls → Third-party performance** on localhost or the exact `demo--etrade--AdobeDrago.aem.page` preview. It is off by default and host-guarded. Compare the same page and interactions with:

- `?perf=baseline`: observers and demo controls, without simulated libraries.
- `?perf=onetrust`: the two captured OneTrust JavaScript payloads.
- `?perf=etrade`: OneTrust plus the selected analytics and advertising payloads.

Choose **Loading strategy** to compare the same script weights and processing budgets:

- **Startup** (`perf-phase=early`): the OneTrust stub and Adobe Launch hold page decoration. The OneTrust banner and dependent tags load asynchronously. This models startup pressure without installing parser-blocking vendor scripts in the document head.
- **EDS** (`perf-phase=eds`): page content loads first. Three seconds after content is ready, the profile and OneTrust fixtures load. Tag fixtures stay unloaded until **Accept simulated tracking** is selected. **Decline simulated tracking** leaves them unloaded; declining after acceptance stops further added tag work. Repeated acceptance does not request completed fixtures again.

The EDS strategy follows [Adobe's CMP integration pattern](https://www.aem.live/developer/cmp-integration). Its simulated CMP has no banner rendering or production tracking. Its `demo-performance:consent.update` events are separate from the site's real `consent.update` events. The existing `late` and `consent` options retain the earlier experiments with OneTrust at startup and tags after content or simulated consent. A URL without `perf-phase` retains startup behavior; the controls suggest EDS for a new comparison.

For example, compare `/home?perf=etrade&perf-phase=early&perf-work=medium` with `/home?perf=etrade&perf-phase=eds&perf-work=medium`. In EDS mode, measure both declined consent (two CMP fixtures) and accepted consent (all 20 fixtures). Waiting for acceptance is part of the strategy, so record when it occurs.

The default `perf-work=none` adds only downloads and parsing of inert JavaScript fixtures. Optional `light|medium|heavy` presets add **assumed** CPU budgets:

| Preset | Initialization per 100 KiB of source | Per click/key press | Background every 2 seconds |
| --- | --- | --- | --- |
| Light | 5 ms | 8 ms | 10 ms |
| Moderate | 20 ms | 40 ms | 30 ms |
| Heavy | 60 ms | 120 ms | 60 ms |

These are fixed wall-clock budgets, not measured vendor execution times or device-scaled instructions. Each initialization task is capped at 500 ms. Interaction/background work runs for 30 seconds once content and tags are ready, skips hidden documents, and can be restarted or stopped in the controls. Use **Test response** or real menus, FAQs and inputs, then **Refresh measurements** after the next paint.

The [capture manifest](scripts/demo-performance-profile.json) records public scripts observed on https://us.etrade.com/home on October 13, 2026: 20 selected files, 3,345,830 decoded bytes and 930,920 bytes in captured gzip responses. OneTrust accounts for 593,410 decoded bytes. Local fixtures match decoded bytes exactly and approximate gzip sizes without copying vendor code. The optional maintenance command `node test/generate-performance-assets.mjs` regenerates fixtures from this manifest; there is no site build step.

This models payload pressure and illustrative main-thread contention. It does not reproduce vendor instruction complexity, cross-origin DNS/TLS, CMP rendering/layout, geographic or consent rules, dynamic Adobe rule modules, vendor config, chat/security libraries, downstream requests or beacon fan-out. Same-origin hosting, compression and caches affect actual transfers; fresh run URLs avoid module reuse, but hosting controls HTTP caching. The AEM local proxy can compress responses for browsers, and its compression may differ from the captured vendors. Use the actual transfer measurement when interpreting a run. No production pixels or identifiers are activated by the emulator.

Compare FCP, LCP, CLS, long tasks, and the slowest observed interaction across repeated runs under identical cache/throttling conditions. The long-task excess includes the whole observed page lifetime; it is not Lighthouse TBT. The slowest Event Timing interaction is a lab observation, not an implementation of field INP. Chrome's Performance panel can show the `demo-third-party:*` task measures. Run `npm run test:performance-demo` for the opt-in, ordering, consent, expiry and fixture-budget checks.
