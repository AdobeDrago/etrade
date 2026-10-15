# Welcome Hero

The desktop campaign sits on the left and the white login panel sits on the right. One authored background image spans the entire hero. Below 768px, login precedes the campaign.

Author a **Welcome Hero** table with two-column named rows:

| Key | Content |
| --- | --- |
| Login | H2, supporting text, standalone login link, recovery/help/security links |
| Campaign | H1, supporting paragraphs, standalone campaign links |
| Image | Image or picture with authored alternative text |

Missing rows/cells are allowed. Extra value cells are combined. A standalone **Log on** link enables the screenshot-matched login panel: User ID, Password with Show/Hide, remember/security-code checkboxes, destination selector, recovery/help links, and security/language footer. Its heading becomes **Log on** and the standard introductory sentence is omitted. Other authored copy and recovery/help destinations remain intact. The first standalone campaign link is primary; later campaign links are secondary. Only the first image is used. A missing image retains the dark campaign background.

The presentation form still hands off to the authored E*TRADE login URL. It does not authenticate, send or store entered credentials, remember user IDs, or apply the destination/security-code choices; those require the identity integration. Inputs deliberately have no submission names, and entered values are cleared before navigation. An identity integration can listen for the bubbling `welcome:login-ready` event and replace `event.detail.slot` (`[data-login-slot]`). The form, event, and language link do not implement authentication.

Content target: `/home/welcome-back`. Preview after code push and content preview: https://demo--etrade--AdobeDrago.aem.page/home/welcome-back

Campaign card icons are named `ira-selector` and `idea` in the first cell; do not paste relative SVG images into DA.
