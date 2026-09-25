'use strict';
const lightbox = document.getElementById('lightbox');
if (lightbox) {
  document.querySelectorAll('img[data-zoom]').forEach(img => {
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
    img.setAttribute('aria-label', `${img.alt} – vergrößern`);
    const open = () => {
      lightbox.querySelector('img').src = img.dataset.fullImage || img.src;
      lightbox.querySelector('img').alt = img.alt;
      lightbox.querySelector('p').textContent = img.alt;
      lightbox.showModal();
    };
    img.addEventListener('click', open);
    img.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });
  lightbox.querySelector('button').addEventListener('click', () => lightbox.close());
  lightbox.addEventListener('click', e => { if (e.target === lightbox) lightbox.close(); });
}

// Share the public project URL, including when previewing the site locally.
const projectShare = document.getElementById('teilen');
if (projectShare) {
  const message = projectShare.querySelector('textarea');
  const status = projectShare.querySelector('[data-share-status]');
  const copyButton = projectShare.querySelector('[data-share-copy]');
  const nativeButton = projectShare.querySelector('[data-share-native]');
  const selectMessage = () => {
    message.focus();
    message.select();
    message.setSelectionRange(0, message.value.length);
  };
  copyButton.hidden = false;
  copyButton.addEventListener('click', async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(message.value);
      status.textContent = 'Text und Link kopiert. Jetzt kannst du beides weitergeben.';
    } catch {
      selectMessage();
      status.textContent = 'Der Text ist markiert. Bitte über „Kopieren“ oder Strg+C / ⌘C kopieren.';
    }
  });
  if (typeof navigator.share === 'function') {
    nativeButton.hidden = false;
    nativeButton.addEventListener('click', async () => {
      status.textContent = '';
      nativeButton.disabled = true;
      try {
        await navigator.share({
          title: projectShare.dataset.shareTitle,
          text: projectShare.dataset.shareText,
          url: projectShare.dataset.shareUrl,
        });
      } catch (error) {
        if (error.name !== 'AbortError') {
          status.textContent = 'Das Teilen-Menü ist gerade nicht verfügbar. Nutze „Text & Link kopieren“ oder einen der Links.';
        }
      } finally {
        nativeButton.disabled = false;
      }
    });
  }
}
