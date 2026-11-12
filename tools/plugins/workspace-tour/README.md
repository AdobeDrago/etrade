# E*TRADE Author Tour

The eight-step tour takes DA authors through a first E*TRADE edit, from picking a draft through reviewing and publishing. It uses the [site handoff guide](../../../docs/site-handoff.html) for reference and opens directly from that guide. Authors choose when to start, and the panel remembers their current step or completion when browser storage is available. The panel displays static content and links.

## Preview

Run `npx -y @adobe/aem-cli up` locally and open `/tools/plugins/workspace-tour/workspace-tour.html`, or follow **Take the author onboarding tour** from `/docs/site-handoff.html`.

## Enable in DA

After pushing the branch and verifying that the plugin URL loads, add a row in the **library** tab of the [E*TRADE DA site configuration](https://da.live/config#/adobedrago/etrade/). Preserve the existing rows and columns.

| title | path | format | icon | experience | ref |
| --- | --- | --- | --- | --- | --- |
| E*TRADE Author Tour | `https://codex-etrade-onboarding-tour--etrade--adobedrago.aem.live/tools/plugins/workspace-tour/workspace-tour.html` | | | inline | codex-etrade-onboarding-tour |

Open [Home in Canvas with the review ref](https://da.live/canvas?ref=codex-etrade-onboarding-tour#/adobedrago/etrade/home) and choose **Outline → Extensions → E*TRADE Author Tour**. Verify that the panel opens, that closing and reopening it lets you continue from the saved step, and that a handoff link opens in a separate tab. Once the plugin is deployed to the intended shared branch, update the URL to that branch's host and clear **ref** to make the tour available from ordinary editor URLs.
