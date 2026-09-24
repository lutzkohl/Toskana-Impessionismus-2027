(() => {
  'use strict';
  const config = JSON.parse(document.getElementById('order-config').textContent);
  const form = document.getElementById('calendar-order');
  const quantities = ['a3','a2'].map(format => document.getElementById(`order-quantity-${format}`));
  const message = document.getElementById('order-message');
  const review = document.getElementById('order-review');
  const requestId = document.getElementById('order-request-id');
  let reviewedData = '';
  const endpointReady = config.live && /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(config.endpoint);
  const sendButton = document.getElementById('review-send');
  function resetSendButton() {
    sendButton.hidden = false;
    sendButton.disabled = !endpointReady;
    sendButton.textContent = 'Kalenderwunsch senden';
  }
  function selection() {
    const counts = quantities.map(input => Number(input.value));
    const total = counts[0] + counts[1];
    const valid = quantities.every(input => /^\d+$/.test(String(input.value))) && counts.every(count => Number.isInteger(count) && count >= 0) && total >= 1 && total <= config.maxQuantity;
    return {counts,total,valid};
  }
  function wishSummary(counts) { return `${counts[0]} × A3 · ${counts[1]} × A2`; }
  function updateSummary() {
    const {counts,total,valid} = selection();
    document.getElementById('wish-summary').textContent = valid ? wishSummary(counts) : `Bitte insgesamt 1 bis ${config.maxQuantity} Kalender auswählen`;
    ['a3','a2'].forEach((format,index) => {
      document.getElementById(`quantity-${format}-minus`).disabled = counts[index] <= 0;
      document.getElementById(`quantity-${format}-plus`).disabled = total >= config.maxQuantity;
    });
    review.hidden = true;
  }
  function changeCount(index, by) {
    const other = Math.max(0, Number(quantities[1-index].value) || 0);
    const next = Math.min(Math.max(0,config.maxQuantity-other), Math.max(0,(Number(quantities[index].value) || 0)+by));
    quantities[index].value = String(next);
    updateSummary();
  }
  ['a3','a2'].forEach((format,index) => {
    document.getElementById(`quantity-${format}-minus`).addEventListener('click', () => changeCount(index,-1));
    document.getElementById(`quantity-${format}-plus`).addEventListener('click', () => changeCount(index,1));
    quantities[index].addEventListener('input', updateSummary);
  });
  form.addEventListener('input', () => { review.hidden = true; message.textContent = ''; });
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!selection().valid) { message.textContent = `Bitte insgesamt mindestens einen und höchstens ${config.maxQuantity} Kalender anfragen.`; quantities[0].focus(); return; }
    if (!form.reportValidity()) return;
    for (const field of form.querySelectorAll('input[required]:not([type=checkbox])')) {
      if (!field.value.trim()) { message.textContent = 'Bitte fülle alle Pflichtfelder aus.'; field.focus(); return; }
    }
    const data = new FormData(form);
    const counts = [Number(data.get('quantityA3')),Number(data.get('quantityA2'))];
    const details = document.createElement('p');
    details.textContent = `${data.get('firstName').trim()} ${data.get('lastName').trim()}\n${data.get('street').trim()}${data.get('addressExtra').trim() ? '\n' + data.get('addressExtra').trim() : ''}\n${data.get('postalCode')} ${data.get('city').trim()}\nDeutschland\n${data.get('email').trim()}\n\n${wishSummary(counts)}`;
    document.getElementById('review-details').replaceChildren(details);
    document.getElementById('review-note').textContent = endpointReady ? 'Mit „Kalenderwunsch senden“ übermittelst du deine Anfrage. Verfügbarkeit und Versand stimmen wir anschließend mit dir ab. Du kannst einen Kalender auch ohne Spende anfragen.' : 'Die Annahme von Kalenderwünschen ist noch nicht geöffnet. Deine Angaben wurden nicht gespeichert oder versendet. Du kannst einen Kalender auch ohne Spende anfragen.';
    resetSendButton();
    const nextData = JSON.stringify([...data].filter(([key]) => key !== 'requestId'));
    if (nextData !== reviewedData || !requestId.value) requestId.value = crypto.randomUUID();
    reviewedData = nextData;
    review.hidden = false;
    review.focus();
    review.scrollIntoView({behavior:'smooth', block:'center'});
  });
  document.getElementById('review-back').addEventListener('click', () => { review.hidden = true; quantities[0].focus(); });
  document.getElementById('review-send').addEventListener('click', () => {
    if (!endpointReady || sendButton.disabled || !selection().valid || !form.reportValidity()) return;
    const now = JSON.stringify([...new FormData(form)].filter(([key]) => key !== 'requestId'));
    if (now !== reviewedData) { review.hidden = true; message.textContent = 'Deine Angaben haben sich geändert. Bitte prüfe die Übersicht erneut.'; return; }
    const button = document.getElementById('review-send');
    button.disabled = true; button.textContent = 'Wird übermittelt …';
    form.action = config.endpoint;
    HTMLFormElement.prototype.submit.call(form);
  });
  window.addEventListener('pageshow', resetSendButton);
  form.querySelector('[type=submit]').disabled = false;
  resetSendButton();
  updateSummary();
})();
