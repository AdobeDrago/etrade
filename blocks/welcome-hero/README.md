# Welcome Hero

The desktop campaign sits on the left and the white login panel sits on the right. One authored background image spans the entire hero. Below 768px, login precedes the campaign.

Author a **Welcome Hero** table with two-column named rows:

| Key | Content |
| --- | --- |
| Login | H2, supporting text, standalone login link, recovery/help/security links |
| Campaign | H1, supporting paragraphs, standalone campaign links |
| Image | Image or picture with authored alternative text |

Missing rows/cells are allowed. Extra value cells are combined. Text, links, inline formatting, and images remain authored. First standalone link within each content area is primary; later links are secondary. Inline recovery links remain inline. Only the first image is used. A missing image retains the dark campaign background.

Login currently hands off to the authored E*TRADE URL; no credential form is implemented. An approved identity integration can listen for the bubbling `welcome:login-ready` event and mount into `event.detail.slot` (`[data-login-slot]`); it must provide the supported E*TRADE component configuration and domain approval. This event by itself does not implement authentication.

Full page seed and review: `docs/welcome-back-authoring.html`, `docs/welcome-back-demo.html`. Content target: `/home/welcome-back`. Preview after code push and content preview: https://demo--etrade--AdobeDrago.aem.page/home/welcome-back

Use the current six-page copy pack at `docs/current-pages-authoring.html?page=welcome-back`. Campaign card icons are named `ira-selector` and `idea` in the first cell; do not paste relative SVG images into DA.
