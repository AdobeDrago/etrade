const response = await fetch('./welcome-back-content.html');
if (!response.ok) throw new Error('Authoring content could not be loaded.');
const html = await response.text();
const container = document.querySelector('#page-content');
container.append(...new DOMParser().parseFromString(html, 'text/html').body.childNodes);
document.querySelector('#copy-page').addEventListener('click', async () => {
  const status = document.querySelector('#copy-status');
  try {
    await navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([container.innerHTML], { type: 'text/html' }),
      'text/plain': new Blob([container.innerText], { type: 'text/plain' }),
    })]);
    status.textContent = 'Copied the complete page. Paste into DA and preview the content.';
  } catch {
    status.textContent = 'Clipboard access was unavailable. Select and copy the page content below.';
  }
});
