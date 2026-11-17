# Footer

The page design family supplies the footer's surface, text, link, hover and native-control scheme: Purple uses a light footer and Charcoal retains the dark footer. Missing page themes retain the existing dark footer. Bundled phone and social icons adapt to the surface in code. Authored logos and custom artwork retain their colors and must suit the chosen surface; use page Metadata `Footer` to choose a separate fragment if its content differs by family. See [Page themes](../../README.md#page-themes) and the [authoring rollout](../../README.md#authoring-rollout).

The global Footer loads an authored fragment at `/footer`. Set page Metadata `Footer` to another local path to use a different fragment. Place one **Footer** block in that document. Only that block is rendered; disclosure copy and other content outside it are not included.

All headings, links, phone numbers, logos, social networks, icon choices, and destinations come from content. There is no default business copy or link list in JavaScript. Missing or empty authored content hides the block safely.

## Authoring

Use a two-column Footer table. The first cell identifies the row; the second cell contains normal rich text. Row names are case insensitive. Rows can be omitted or reordered; repeat Column rows to add navigation columns.

| Footer | |
| --- | --- |
| Contact | Heading 2, then a paragraph containing your telephone link and optional `:phone:` icon. |
| Social | A bulleted list of links. Each link contains an optional icon and its accessible label. |
| Column | Heading 3, then a bulleted list of navigation links. |
| Column | Another heading and link list. |
| Brand | Optional linked logo image with authored alternative text. |

Production's contact-and-links footer has Contact, Social, and three Column rows, with no logo. Brand is optional if another footer needs one. Contact and Brand content appear first; Social follows the contact details. Columns keep their authored order.

Example of a Social cell's resulting markup:

```html
<ul>
  <li><a href="https://www.facebook.com/your-profile">
    <span class="icon icon-social-facebook"></span>Visit our Facebook page
  </a></li>
</ul>
```

In the authoring document, insert `:social-facebook:` inside the link alongside its label. Available assets: `social-facebook`, `social-twitter` (the X mark), `social-linkedin`, `social-youtube`, `social-instagram`, and `phone`. Authors choose which icons to use; the block never chooses networks from the destination. Linked images with alternative text are also supported. Text-only social links remain visible. Icon links without text, an `aria-label`, or image alternative text are omitted because they have no accessible name.

The optional Brand row uses a regular linked image, with an appropriate image alternative text. No logo path is built into the block. Telephone links must be authored with a `tel:` destination. Link destinations, tracking parameters, and targets are preserved. New-tab links receive `noopener noreferrer`.

To make a link open cookie preferences, select **Link action → Open cookie preferences** in [Link Options](../../tools/plugins/link-options/README.md), copy `@privacy-preferences`, and paste it into DA's native link dialog. No destination URL is needed. The shared decorator records `data-link-action="privacy-preferences"`, removes new-tab behavior and gives the control button semantics with Enter and Space support. The action is independent of the wording and icon; `:privacy-options:` is optional artwork and does not activate OneTrust. Choosing **Normal link** requires a destination URL again.

The explicit action opens the actual OneTrust preference center. If OneTrust is not already available, the first click loads E*TRADE's published OneTrust script from `cdn2.etrade.net`, with domain ID `01953914-53cc-7833-b8d6-c9c9d7301ff9`, and queues the request until initialization finishes. Repeated clicks while loading share that request. The script, configuration, appearance, geographic rules and cookie controls come from OneTrust; no custom cookie dialog is rendered. An existing consent integration can handle the cancelable, bubbling `privacy:open` event before the loader starts.

Update the existing **Your Privacy Choices** URL in the shared `/footer` document to `@privacy-preferences`, save and preview that content, then open `/home` and select the link. The E*TRADE-branded OneTrust **Cookie Preferences** center should open on the current page. No demo-overlay setup or page query parameters are needed. The separate **Privacy & Cookies** link keeps its authored destination. The action has no privacy-page fallback: loading errors leave the visitor on the current page and do not grant consent. The reserved token requires the site runtime; deploy it before authoring the action. Ordinary section links such as `#privacy-preferences` retain their normal behavior. Older `@action=privacy-preferences` links are recognized by the runtime and converted to the action-only form; update their authored URLs to remove the old external destination as well. Deploy the runtime and update the authored footer together; icon-only links navigate normally.

## Layout and accessibility

- Theme-selected surface, production typography, contact heading, circular social icons, and purple navigation links.
- Below 768px, all columns stack and remain expanded, matching production. Social links stay available.
- From 768px, contact and navigation sit side by side. The three-column layout follows production's tablet and desktop proportions. Additional columns wrap into further rows.
- Native links and headings, one navigation landmark, authored social labels, visible keyboard focus, and hover/focus underlines. Icons next to social labels are decorative to screen readers.
- The global `<footer>` supplies the contentinfo landmark. This block contains no disclosures, legal copy, copyright strip, or login-state logic.

Source and content publish separately. Create and preview the `/footer` document before expecting the footer on regular pages; the block intentionally supplies no fallback content.

## Migration review

This component is migrated on `et-footer`. Review its changes against `develop`; merge the prerequisite first when the base is a feature branch.

Preview: https://et-footer--etrade--AdobeDrago.aem.page/home

Authored content is transferred separately. Existing sandbox integration and campaign limitations still apply.

## Shared style system

This block consumes the shared color, typography, spacing, border, focus and applicable motion tokens. Narrow section cells and enlarged text reflow within the block. Authored Section Metadata takes precedence over legacy surrounding section styles; content, links and existing interactions are preserved. See the [shared component styles](../../README.md#shared-component-styles) for ownership and validation on `etrade-style`.
