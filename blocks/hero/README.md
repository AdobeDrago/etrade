# Hero

Full-width background-image hero used by Platforms. The exact DA table name is **Hero**. It does not render the image beside the copy. `hero-split` and `hero-bg` are not separate block names in this repository.

| Hero | |
| --- | --- |
| H1: Platforms; H2: Power your trading & investing; supporting paragraph with the matching disclosure ID; standalone Open an account link paragraph | Image with authored alternative text |

The existing separate content and image rows also work. Rows and cells may be added or omitted. Optional two-column named rows **Eyebrow**, **Heading**, **Content**, and **Image** are accepted. Keep body copy at normal rich-text weight unless emphasis is intentional.

The first image becomes the full-width background, retaining its picture sources, dimensions and alternative text. It uses cover sizing anchored at the top left, matching the Platforms reference, including its purple image area behind the copy on mobile. A missing image leaves a solid purple surface. Select the actual Platforms background asset; the component does not synthesize the image’s purple treatment.

Copy stays left aligned in a 1200px container. The first standalone CTA becomes a primary action; additional standalone CTAs become secondary actions. Inline links remain in the body. Headings, IDs, superscripts, rich text, destinations and tracking remain authored. First-section images load eagerly; later images retain their loading behavior.

For Investment Choices, use **Hero (Wide)** with the verified cactus background.
This variant gives desktop copy a 580px maximum width and 100px vertical padding,
matching the live introduction. The ordinary Hero keeps the Platforms layout.

Use **Hero Dark (Split)** for the existing separate text/media design and **Hero Light** for the text-only introduction. Those are different layouts.

Save and preview content separately from shipping code. Local preview with the working tree: http://127.0.0.1:3030/platforms.
