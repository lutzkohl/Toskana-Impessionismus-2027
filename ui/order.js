(() => {
  'use strict';
  const config = JSON.parse(document.getElementById('order-config').textContent);
  const form = document.getElementById('calendar-order');
  const quantity = document.getElementById('order-quantity');
  const message = document.getElementById('order-message');
  const review = document.getElementById('order-review');
  const requestId = document.getElementById('order-request-id');
  const euro = cents => new Intl.NumberFormat('de-DE', {style:'currency', currency:'EUR'}).format(cents / 100);
  let reviewedData = '';
  const endpointReady = config.live && /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(config.endpoint);
  function updateTotal() {
    const count = Number(quantity.value);
    const valid = /^\d+$/.test(quantity.value) && Number.isInteger(count) && count >= 1 && count <= config.maxQuantity;
    document.getElementById('subtotal-label').textContent = valid ? `${count} Kalender × ${euro(config.unitCents)}` : 'Bitte eine gültige Stückzahl eingeben';
    document.getElementById('order-subtotal').textContent = valid ? euro(count * config.unitCents) : '—';
    document.getElementById('order-total').textContent = valid ? euro(count * config.unitCents + config.shippingCents) : '—';
    document.getElementById('order-shipping').textContent = euro(config.shippingCents);
    document.getElementById('quantity-minus').disabled = count <= 1;
    document.getElementById('quantity-plus').disabled = count >= config.maxQuantity;
    review.hidden = true;
  }
  function changeCount(by) { const next = Math.min(config.maxQuantity, Math.max(1, (Number(quantity.value) || 1) + by)); quantity.value = next; updateTotal(); }
  document.getElementById('quantity-minus').addEventListener('click', () => changeCount(-1));
  document.getElementById('quantity-plus').addEventListener('click', () => changeCount(1));
  quantity.addEventListener('input', updateTotal);
  form.addEventListener('input', () => { review.hidden = true; message.textContent = ''; });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    for (const field of form.querySelectorAll('input[required]:not([type=checkbox])')) {
      if (!field.value.trim()) { message.textContent = 'Bitte fülle alle Pflichtfelder aus.'; field.focus(); return; }
    }
    const data = new FormData(form);
    const count = Number(data.get('quantity'));
    const details = document.createElement('p');
    details.textContent = `${data.get('firstName').trim()} ${data.get('lastName').trim()}\n${data.get('street').trim()}${data.get('addressExtra').trim() ? '\n' + data.get('addressExtra').trim() : ''}\n${data.get('postalCode')} ${data.get('city').trim()}\nDeutschland\n${data.get('email').trim()}\n\n${count} Kalender: ${euro(count * config.unitCents)}\nVersand: ${euro(config.shippingCents)}\nGesamt: ${euro(count * config.unitCents + config.shippingCents)}`;
    document.getElementById('review-details').replaceChildren(details);
    document.getElementById('review-note').textContent = endpointReady ? 'Im nächsten Schritt wird deine Anfrage gespeichert und der Zahlungslink geöffnet. Eine Zahlung gilt erst nach Prüfung beim Zahlungsanbieter als eingegangen.' : 'Das ist eine Vorschau. Es wurde nichts gespeichert, bestellt oder bezahlt.';
    document.getElementById('review-send').hidden = !endpointReady;
    const nextData = JSON.stringify([...data].filter(([key]) => key !== 'requestId'));
    if (nextData !== reviewedData || !requestId.value) requestId.value = crypto.randomUUID();
    reviewedData = nextData;
    review.hidden = false;
    review.focus();
    review.scrollIntoView({behavior:'smooth', block:'center'});
  });
  document.getElementById('review-back').addEventListener('click', () => { review.hidden = true; quantity.focus(); });
  document.getElementById('review-send').addEventListener('click', () => {
    if (!endpointReady || !form.reportValidity()) return;
    const now = JSON.stringify([...new FormData(form)].filter(([key]) => key !== 'requestId'));
    if (now !== reviewedData) { review.hidden = true; message.textContent = 'Deine Angaben haben sich geändert. Bitte prüfe die Übersicht erneut.'; return; }
    const button = document.getElementById('review-send');
    button.disabled = true; button.textContent = 'Wird übermittelt …';
    form.action = config.endpoint;
    HTMLFormElement.prototype.submit.call(form);
  });
  window.addEventListener('pageshow', () => { const b = document.getElementById('review-send'); b.disabled = false; b.textContent = 'Weiter zur Zahlung'; });
  form.querySelector('[type=submit]').disabled = false;
  updateTotal();
})();
