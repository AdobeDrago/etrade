import { decorateAction, standaloneAction } from '../../scripts/actions.js';

let mediaSequence = 0;

function container(className) {
  const node = document.createElement('div');
  node.className = `hero-dark-${className}`;
  return node;
}

/** Split heroes accept named rows and the existing imported image/copy cells. */
function decorateSplit(block) {
  const content = container('content');
  const media = container('media');
  const offer = container('offer');
  const eyebrow = container('eyebrow');
  const title = container('title');
  const copy = container('copy');
  const parts = new Map([
    ['eyebrow', eyebrow], ['heading', title], ['content', copy],
    ['image', media], ['offer', offer],
  ]);
  const cells = [];
  [...block.children].forEach((row) => {
    const [key, ...values] = row.children;
    const part = values.length && parts.get(key?.textContent.trim().toLowerCase());
    if (part) values.forEach((cell) => part.append(...cell.childNodes));
    else cells.push(...row.children);
  });

  const loose = container('loose');
  cells.forEach((cell) => loose.append(...cell.childNodes));
  const headings = [...loose.querySelectorAll('h1, h2, h3')];
  // Imported account heroes use an H1 eyebrow followed by an H2 headline.
  if (!title.textContent.trim() && !eyebrow.textContent.trim() && headings.length > 1
    && headings[0].matches('h1') && headings[1].matches('h2')) {
    eyebrow.append(headings[0]);
    title.append(headings[1]);
  } else if (!title.textContent.trim() && headings[0]) title.append(headings[0]);

  const image = media.querySelector('picture, img') || loose.querySelector('picture, img');
  if (image) {
    const imageParent = image.parentElement;
    const img = image.matches('img') ? image : image.querySelector('img');
    media.prepend(image);
    if (imageParent?.matches('p') && !imageParent.textContent.trim()
      && !imageParent.querySelector('img, picture')) imageParent.remove();
    if (img && block.closest('.section') === document.querySelector('main > .section')) {
      img.loading = 'eager';
      img.setAttribute('fetchpriority', 'high');
    }
  } else block.classList.add('no-image');

  [...loose.childNodes].forEach((node) => {
    if (node.textContent.trim() || node.querySelector?.('img, picture')) copy.append(node);
  });
  const heading = title.querySelector('h1, h2, h3');
  if (heading) heading.classList.add('hero-dark-heading');
  else block.classList.add('no-heading');

  const actions = container('actions');
  actions.classList.add('etrade-actions');
  [...copy.querySelectorAll('p')].forEach((paragraph) => {
    const link = standaloneAction(paragraph);
    if (!link) return;
    decorateAction(link, actions.children.length ? 'secondary' : 'primary', 'hero-dark');
    const action = container('action');
    action.append(link);
    actions.append(action);
    paragraph.remove();
  });
  if (actions.children.length) copy.append(actions);
  [eyebrow, title, copy].forEach((part) => {
    if (part.textContent.trim() || part.querySelector('img, picture')) content.append(part);
  });

  if (offer.textContent.trim()) {
    const offerHeading = offer.querySelector('h1, h2, h3, h4');
    if (offerHeading) offerHeading.classList.add('hero-dark-offer-heading');
    const offerActions = container('offer-actions');
    offerActions.classList.add('etrade-actions');
    [...offer.querySelectorAll('p')].forEach((paragraph) => {
      const link = standaloneAction(paragraph);
      if (!link) return;
      decorateAction(link, 'secondary', 'hero-dark');
      offerActions.append(link);
      paragraph.remove();
    });
    if (offerActions.children.length) offer.append(offerActions);
    media.append(offer);
    block.classList.add('has-offer');
  }

  // Content precedes image and offer in the DOM and on narrow screens.
  block.replaceChildren();
  if (content.childNodes.length) block.append(content);
  else block.classList.add('no-content');
  if (media.textContent.trim() || media.querySelector('img, picture')) block.append(media);
}

export default function decorate(block) {
  if (block.classList.contains('split')) {
    decorateSplit(block);
    return;
  }
  const previous = block.parentElement.previousElementSibling;
  if (previous?.matches('.default-content-wrapper') && previous.children.length === 1
    && previous.firstElementChild.matches('p') && previous.textContent.trim() === 'Home'
    && !previous.querySelector('a, img')) previous.classList.add('hero-dark-breadcrumb');
  const options = new Map();
  [...block.children].forEach((row) => {
    const [key, ...values] = row.children;
    const name = key?.textContent.trim().toLowerCase();
    if (!values.length || !['media', 'media description'].includes(name)) return;
    const content = container(name.replaceAll(' ', '-'));
    values.forEach((cell) => content.append(...cell.childNodes));
    options.set(name, content);
    row.remove();
  });
  const heading = block.querySelector('h1, h2, h3');
  const image = block.querySelector('picture, img');
  const copy = container('copy');
  const media = container('media');
  const actions = container('actions');
  actions.classList.add('etrade-actions');
  const cells = [...block.children].flatMap((row) => [...row.children]);
  const imageCell = cells.find((cell) => image && cell.contains(image));
  const hasCaption = cells.length > 1 && imageCell && !imageCell.querySelector('h1, h2, h3')
    && ![...imageCell.querySelectorAll('p')].some(standaloneAction);

  if (heading) {
    heading.classList.add('hero-dark-heading');
    heading.remove();
  }
  if (image) {
    media.append(image);
    const img = image.matches('img') ? image : image.querySelector('img');
    // Eager loading is only appropriate for the first section's hero image.
    if (img && block.closest('.section') === document.querySelector('main > .section')) {
      img.loading = 'eager';
      img.setAttribute('fetchpriority', 'high');
    }
  } else if (options.has('media')) {
    const source = options.get('media').querySelector('a[href]');
    if (source && /\.mp4(?:[?#]|$)/i.test(source.href)) {
      const video = document.createElement('video');
      video.src = source.href;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';
      const description = options.get('media description');
      if (description?.textContent.trim()) {
        mediaSequence += 1;
        description.id = `hero-dark-media-description-${mediaSequence}`;
        video.setAttribute('aria-describedby', description.id);
        media.append(description);
      }
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'hero-dark-media-toggle';
      const update = () => {
        toggle.setAttribute('aria-label', video.paused ? 'Play animation' : 'Pause animation');
        toggle.textContent = video.paused ? '▶' : 'Ⅱ';
      };
      toggle.addEventListener('click', () => {
        if (video.paused) video.play().catch(update);
        else video.pause();
      });
      video.addEventListener('play', update);
      video.addEventListener('pause', update);
      let plays = 0;
      video.addEventListener('ended', () => {
        plays += 1;
        if (plays < 2) video.play().catch(update);
      });
      const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
      const visibility = window.matchMedia('(width > 768px)');
      const start = () => {
        if (motion.matches) {
          video.pause();
          if (Number.isFinite(video.duration)) {
            video.currentTime = Math.max(0, video.duration - 0.1);
          }
        } else if (visibility.matches && plays < 2) video.play().catch(update);
        else video.pause();
      };
      video.addEventListener('loadedmetadata', start, { once: true });
      motion.addEventListener('change', start);
      visibility.addEventListener('change', start);
      video.addEventListener('error', () => {
        block.classList.add('media-unavailable');
        media.hidden = true;
      }, { once: true });
      media.append(video, toggle);
      block.classList.add('has-video');
      update();
    }
  }
  if (!image && !media.children.length) block.classList.add('no-image');

  cells.forEach((cell) => {
    [...cell.childNodes].forEach((node) => {
      if (!node.textContent.trim() && !node.querySelector?.('img, picture')) return;
      // Copy next to an image in its own cell is an authored media caption.
      (hasCaption && cell === imageCell ? media : copy).append(node);
    });
  });

  // Only standalone links are CTAs. Inline links stay in the supporting copy.
  [...copy.querySelectorAll('p')].forEach((paragraph) => {
    const link = standaloneAction(paragraph);
    if (!link) return;
    const primary = !actions.children.length;
    decorateAction(link, primary ? 'primary' : 'secondary', 'hero-dark');
    const action = container('action');
    action.append(link);
    actions.append(action);
    paragraph.remove();
  });
  if (actions.children.length) copy.append(actions);

  // Reading order stays heading, copy, links, image at every screen size.
  block.replaceChildren();
  if (heading) block.append(heading);
  else block.classList.add('no-heading');
  if (copy.childNodes.length) block.append(copy);
  else block.classList.add('no-copy');
  if (media.children.length) block.append(media);
}
