# E*TRADE Onboarding Tour

The tour covers the site experience, data and privacy, workspace tools and demos, and authoring and release. Each chapter includes worked examples and links into the [site handoff guide](../../../docs/site-handoff.html). Choose any chapter. The panel remembers each chapter’s step or completion when browser storage is available, including progress from the original authoring tour.

## Preview

Run `npx -y @adobe/aem-cli up` locally and open `/tools/plugins/workspace-tour/workspace-tour.html`, or follow **Take the E*TRADE onboarding tour** from `/docs/site-handoff.html`.

## Enable in DA

After pushing the branch and verifying that the plugin URL loads, add a row in the **library** tab of the [E*TRADE DA site configuration](https://da.live/config#/adobedrago/etrade/). Preserve the existing rows and columns.

| title | path | format | icon | experience | ref |
| --- | --- | --- | --- | --- | --- |
| E*TRADE Onboarding Tour | `https://codex-etrade-onboarding-tour--etrade--adobedrago.aem.live/tools/plugins/workspace-tour/workspace-tour.html` | | | inline | codex-etrade-onboarding-tour |

Open [Home in Canvas with the review ref](https://da.live/canvas?ref=codex-etrade-onboarding-tour#/adobedrago/etrade/home) and choose **Outline → Extensions → E*TRADE Onboarding Tour**. Verify that the panel opens, that closing and reopening it lets you continue each chapter from the saved step, and that a handoff link opens in a separate tab. Once the plugin is deployed to the intended shared branch, update the URL to that branch's host and clear **ref** to make the tour available from ordinary editor URLs.
