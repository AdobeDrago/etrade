# Footer

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

The production “Your Privacy Choices” control opens its consent manager. Author a working privacy-page link for the sandbox; connecting a consent-manager action requires that site's separate consent integration. Do not author a destinationless anchor as an interactive control.

## Layout and accessibility

- Dark surface, production typography, contact heading, circular social icons, and purple navigation links.
- Below 768px, all columns stack and remain expanded, matching production. Social links stay available.
- From 768px, contact and navigation sit side by side. The three-column layout follows production's tablet and desktop proportions. Additional columns wrap into further rows.
- Native links and headings, one navigation landmark, authored social labels, visible keyboard focus, and hover/focus underlines. Icons next to social labels are decorative to screen readers.
- The global `<footer>` supplies the contentinfo landmark. This block contains no disclosures, legal copy, copyright strip, or login-state logic.

Source and content publish separately. Create and preview the `/footer` document before expecting the footer on regular pages; the block intentionally supplies no fallback content.

## Migration review

This component is migrated on `et-footer`. Review its changes against `develop`; merge the prerequisite first when the base is a feature branch.

Preview: https://et-footer--etrade--AdobeDrago.aem.page/home

Authored content is transferred separately. Existing sandbox integration and campaign limitations still apply.
