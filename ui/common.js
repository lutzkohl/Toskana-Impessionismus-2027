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
