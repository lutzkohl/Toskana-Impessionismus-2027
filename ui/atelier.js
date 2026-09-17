'use strict';
(() => {
const $ = id => document.getElementById(id);
const catalog = JSON.parse($('atelier-catalog').textContent);
const sources = JSON.parse($('atelier-sources').textContent);
const prefix = document.body.dataset.prefix;
const local = document.body.dataset.mode === 'local';
const storageKey = 'toskana-2027-selection-v1';
const byId = new Map(catalog.map(item => [item.id, item]));
const months = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const weekdays = ['Mo','Di','Mi','Do','Fr','Sa','So'];
const layouts = [
  {id:'leiste', name:'Die klare Leiste', short:'Bild oben, Tage unten. QR rechts.', description:'Eine schmale Tagesleiste mit dem QR-Code rechts. Der Titel steht zwischen Bild und Kalendarium. Das Bild wird leicht beschnitten.'},
  {id:'lichtband', name:'Das Lichtband', short:'Ein helles Band direkt im Bild.', description:'Titel und Tage liegen auf einem durchscheinenden weißen Band. Der QR-Code bleibt auf reinem Weiß. Das Bild wird für die große Fläche beschnitten.'},
  {id:'seitenrand', name:'Der Seitenrand', short:'Das ganze Bild. Der Monat daneben.', description:'Das Bild bleibt vollständig sichtbar. Rechts stehen der Monat als Wochenraster und darunter der QR-Code.'},
  {id:'schwebend', name:'Die schwebende Karte', short:'Ein Monatsraster über der Bildkante.', description:'Eine weiße Kalenderkarte überlappt den unteren Bildrand. Der QR-Code sitzt neben dem Wochenraster. Das Bild wird leicht beschnitten.'}
];
const layoutById = new Map(layouts.map(x => [x.id,x]));
const defaults = () => ({favorite:false,stars:0,note:'',month:null,layout:'leiste'});
let state = JSON.parse($('atelier-state').textContent), blocked = false, queue = Promise.resolve();
const value = id => ({...defaults(),...state.items[id]});
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const asset = path => prefix + 'assets/' + path;
const shortArtist = item => item.artist.name.replace('Pierre-Auguste ','').replace('Claude ','').replace('Paul ','').replace('Vincent ','').replace('Giovanni ','');
function validState(s) {
  if(!s || s.version!==1 || s.year!==2027 || !Number.isInteger(s.revision) || s.revision<0 || !s.items || typeof s.items!=='object' || Array.isArray(s.items)) throw Error('Die gespeicherte Auswahl hat ein unbekanntes Format.');
  const clean={version:1,year:2027,revision:s.revision,items:{}}, used=new Set();
  for(const [id,raw] of Object.entries(s.items)) {
    if(!byId.has(id) || !raw || typeof raw!=='object' || Array.isArray(raw)) throw Error('Die Auswahl enthält ein unbekanntes Bild.');
    const v={...defaults(),...raw};
    if(v.month!==null && (!Number.isInteger(v.month)||v.month<1||v.month>12||used.has(v.month))) throw Error('Ein Monat ist ungültig oder doppelt belegt.');
    if(v.month!==null)used.add(v.month);
    if(!layoutById.has(v.layout)||typeof v.favorite!=='boolean'||!Number.isInteger(v.stars)||v.stars<0||v.stars>5||typeof v.note!=='string'||v.note.length>2000) throw Error('Eine gespeicherte Bildauswahl ist ungültig.');
    clean.items[id]={favorite:v.favorite,stars:v.stars,note:v.note,month:v.month,layout:v.layout};
  }
  return clean;
}
try {
  const saved = local ? null : localStorage.getItem(storageKey);
  state = validState(saved ? JSON.parse(saved) : state);
} catch(error) {
  blocked=true;
  $('atelier-save-status').textContent=error.message+' Bitte den bestehenden Stand in der Bildauswahl prüfen.';
}
const params = new URLSearchParams(location.search);
let active = byId.get(params.get('bild')) || byId.get('populonia-signac-saint-tropez') || catalog[0];
let city = active.place_slug;
let month = Number(params.get('monat'));
if(!Number.isInteger(month)||month<1||month>12) month=value(active.id).month || active.suggested_month;
let layout = layoutById.has(params.get('layout')) ? params.get('layout') : value(active.id).layout;
const cities = [...new Map(catalog.map(item=>[item.place_slug,item.place])).entries()];
cities.sort((a,b)=>a[1].localeCompare(b[1],'de'));
$('city-select').innerHTML=cities.map(([id,name])=>`<option value="${escape(id)}">${escape(name)}</option>`).join('');
function message(text) { $('atelier-save-status').textContent=text; }
function persist() {
  if(blocked) {message('Speichern angehalten. Auswahl exportieren und Seite neu laden.');return;}
  if(!local) {
    try {localStorage.setItem(storageKey,JSON.stringify(state));message('In diesem Browser gespeichert.');}
    catch(error) {message('Browser-Speicher nicht verfügbar. Bitte die Auswahl exportieren.');}
    return;
  }
  const snapshot=JSON.parse(JSON.stringify(state));
  message('Wird im Projekt gespeichert …');
  queue=queue.then(async()=>{
    if(blocked)return;
    snapshot.revision=state.revision;
    const response=await fetch(prefix+'api/kalender/auswahl',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(snapshot)});
    const data=await response.json();
    if(!response.ok)throw Error(data.error || 'Speichern fehlgeschlagen.');
    state.revision=data.revision;
    message('Im Projekt gespeichert.');
  }).catch(error=>{blocked=true;message(error.message+' Bitte die Auswahl exportieren und neu laden.');});
}
function calendarDays() {
  const count = new Date(Date.UTC(2027,month,0)).getUTCDate();
  return Array.from({length:count},(_,i)=>{
    const weekday=(new Date(Date.UTC(2027,month-1,i+1)).getUTCDay()+6)%7;
    return {day:i+1,weekday,label:weekdays[weekday],cls:weekday===6?'sun':weekday===5?'sat':''};
  });
}
function paper(kind, interactive=false) {
  const days=calendarDays();
  const blank='<span class="date empty" aria-hidden="true"></span>';
  const cells=blank.repeat(days[0].weekday)+days.map(d=>`<span class="date ${d.cls}"><b>${d.day}</b></span>`).join('')+blank.repeat(42-days[0].weekday-days.length);
  const qr=`<img src="${escape(asset(active.qr_asset))}" alt="QR-Code zur Begleitseite">`;
  return `<article class="calendar-design layout-${kind}" style="--month-name-size:${months[month-1].length>7?3.5:4.6}cqw" aria-label="${escape(active.place)}, ${months[month-1]} 2027, ${layoutById.get(kind).name}">
    <img class="paint" src="${escape(asset(active.asset))}" alt="${escape(active.place+' nach '+active.artist.name)}">
    <div class="print-title"><h3>${escape(active.place)}</h3><p>Im Stil von ${escape(active.artist.name)}</p><small>Nach „${escape(active.reference.title)}“, ${escape(active.reference.year)}</small></div>
    <div class="date-zone"><div class="print-month"><strong>${months[month-1]}</strong><span>2027</span></div>
      <div class="date-list" style="--day-count:${days.length}">${days.map(d=>`<div class="date ${d.cls}"><span>${d.label}</span><b>${d.day}</b></div>`).join('')}</div>
      <div class="week-labels">${weekdays.map(d=>`<span>${d}</span>`).join('')}</div><div class="week-grid">${cells}</div>
      ${interactive?`<a class="qr-block" href="${escape(prefix+'bilder/'+active.id+'/')}" aria-label="Begleitseite zu ${escape(active.place)} öffnen">${qr}</a>`:`<span class="qr-block">${qr}</span>`}
    </div><span class="edition">Toskana 2027 · KI-Interpretation · Gestaltungsentwurf</span>
  </article>`;
}
function renderPreview() {
  $('large-preview').innerHTML=paper(layout,true);
  $('modal-preview').innerHTML=paper(layout,true);
  $('preview-label').textContent=active.place+' nach '+shortArtist(active);
  $('layout-caption').textContent=layoutById.get(layout).description;
  $('layout-options').innerHTML=layouts.map(l=>`<button type="button" class="layout-option" data-layout="${l.id}" aria-pressed="${layout===l.id}" aria-label="${l.name}: ${l.short}"><div class="paper-frame" aria-hidden="true">${paper(l.id)}</div><strong>${l.name}</strong><span>${l.short}</span></button>`).join('');
  $('atelier-month').value=month;
  $('save-combination').textContent='Für '+months[month-1]+' vormerken';
  $('city-select').value=city;
  $('active-place').textContent=active.place;
  const source=sources.find(s=>s.id===active.source_id);
  $('active-motif').textContent=source ? source.caption : active.source_caption;
  $('active-reference').textContent='Nach „'+active.reference.title+'“, '+active.reference.year;
  const siblings=catalog.filter(x=>x.source_id===active.source_id);
  $('painter-options').innerHTML=siblings.map(item=>`<button type="button" class="painter-option" data-art="${escape(item.id)}" aria-pressed="${item.id===active.id}"><img src="${escape(asset(item.asset))}" alt=""><span>${escape(shortArtist(item))}</span></button>`).join('');
  $('favorite-combination').textContent=value(active.id).favorite?'♥ Als Favorit markiert':'♡ Bild als Favorit';
  $('favorite-combination').setAttribute('aria-pressed',String(value(active.id).favorite));
  const url=new URL(location.href);url.searchParams.set('bild',active.id);url.searchParams.set('monat',month);url.searchParams.set('layout',layout);history.replaceState(null,'',url);
}
function renderMatrix() {
  const items=catalog.filter(i=>i.place_slug===city);
  const artists=[...new Map(items.map(i=>[i.artist.slug,i])).values()];
  let rows=sources.filter(s=>s.place_slug===city);
  // Selected original photos are still available if a public export lacks extra sources.
  if(!rows.length) rows=[...new Map(items.map(i=>[i.source_id,{id:i.source_id,asset:i.photo_asset,caption:i.source_caption,filename:'Ausgangsfoto'}])).values()];
  rows.sort((a,b)=>Number(items.some(i=>i.source_id===b.id))-Number(items.some(i=>i.source_id===a.id)));
  const onlyFavorites=$('only-favorites').checked;
  if(onlyFavorites)rows=rows.filter(s=>items.some(i=>i.source_id===s.id&&value(i.id).favorite));
  $('matrix-description').textContent=active.place+': '+sources.filter(s=>s.place_slug===city).length+' Fotos, '+items.length+' gemalte Varianten. Zum Gestalten auf ein Bild klicken.';
  $('matrix-head').innerHTML='<tr><th scope="col">Unser Ausgangsfoto<small>Ein Motiv pro Zeile</small></th>'+artists.map(i=>`<th scope="col">${escape(i.artist.name)}<small>${escape(i.artist.movement)}</small></th>`).join('')+'</tr>';
  $('matrix-body').innerHTML=rows.map(source=>`<tr><th scope="row"><button type="button" class="photo-button" data-photo="${escape(source.id)}" aria-label="Ausgangsfoto ${escape(source.caption)} vergrößern"><img src="${escape(asset(source.asset))}" alt="${escape(source.caption)}" loading="lazy"></button><span class="source-caption">${escape(source.caption)}</span><span class="source-filename">${escape(source.filename || '')}</span></th>${artists.map(a=>{
    const variants=items.filter(i=>i.source_id===source.id&&i.artist.slug===a.artist.slug);
    if(!variants.length)return '<td><div class="pending-art">Noch nicht gemalt<small>Offene Kombination</small></div></td>';
    return '<td>'+variants.map(i=>onlyFavorites&&!value(i.id).favorite?'<p class="pending-art">Kein Favorit</p>':`<button type="button" class="matrix-art" data-art="${escape(i.id)}" aria-pressed="${active.id===i.id}" aria-label="${escape(source.caption+' nach '+i.artist.name+' auswählen')}"><img src="${escape(asset(i.asset))}" alt="${escape('KI-Variante nach '+i.artist.name)}" loading="lazy"><small class="matrix-reference">Nach „${escape(i.reference.title)}“</small><span>${active.id===i.id?'In der Vorschau':'Im Kalender ansehen'} <b>${value(i.id).favorite?'♥':''}</b></span></button>`).join('')+'</td>';
  }).join('')}</tr>`).join('');
  $('no-favorites').hidden=rows.length>0;
}
function renderYear() {
  const count=catalog.filter(i=>value(i.id).month).length;
  $('year-count').textContent=count+' / 12';
  $('atelier-months').innerHTML=months.map((name,index)=>{
    const item=catalog.find(i=>value(i.id).month===index+1);
    return `<div class="year-month ${item?'is-assigned':''}"><button type="button" class="year-open" data-month="${index+1}" ${item?`data-id="${escape(item.id)}"`:''} aria-label="${name}: ${item?escape(item.place+', bearbeiten'):'noch offen, gestalten'}"><strong>${name}</strong>${item?`<span class="month-art"><img src="${escape(asset(item.asset))}" alt=""><small>${escape(item.place)}<br>${escape(shortArtist(item))}<br>${layoutById.get(value(item.id).layout).name}</small></span>`:'<span class="empty-month">+ Motiv wählen</span>'}</button>${item?`<button type="button" class="year-remove" data-remove="${escape(item.id)}" aria-label="${name} wieder freigeben">×</button>`:''}</div>`;
  }).join('');
}
function render() {renderPreview();renderMatrix();renderYear();}
function selectImage(id) {if(!byId.has(id))return;active=byId.get(id);city=active.place_slug;render();}
function openPhoto(source) {
  const box=$('lightbox');box.querySelector('img').src=asset(source.asset);box.querySelector('img').alt=source.caption;box.querySelector('p').textContent=source.caption;box.showModal();
}
$('layout-options').addEventListener('click',event=>{
  const button=event.target.closest('[data-layout]');if(!button)return;
  layout=button.dataset.layout;renderPreview();
  // Keep keyboard focus on the selected option after replacing the previews.
  $('layout-options').querySelector(`[data-layout="${layout}"]`).focus({preventScroll:true});
});
$('painter-options').addEventListener('click',event=>{const button=event.target.closest('[data-art]');if(button){selectImage(button.dataset.art);$('painter-options').querySelector(`[data-art="${active.id}"]`).focus({preventScroll:true});}});
$('matrix-body').addEventListener('click',event=>{
  const art=event.target.closest('[data-art]'),photo=event.target.closest('[data-photo]');
  if(art){selectImage(art.dataset.art);$('entwurf').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
  if(photo){const source=sources.find(s=>s.id===photo.dataset.photo);if(source)openPhoto(source);}
});
$('city-select').addEventListener('change',event=>{selectImage(catalog.find(i=>i.place_slug===event.target.value).id);});
$('atelier-month').addEventListener('change',event=>{month=Number(event.target.value);renderPreview();});
$('only-favorites').addEventListener('change',renderMatrix);
$('favorite-combination').addEventListener('click',()=>{if(blocked)return message('Bitte erst den Speicherstand prüfen.');state.items[active.id]={...value(active.id),favorite:!value(active.id).favorite};render();persist();});
$('save-combination').addEventListener('click',()=>{
  if(blocked)return message('Bitte erst den Speicherstand prüfen.');
  const occupied=catalog.find(i=>i.id!==active.id&&value(i.id).month===month);
  if(occupied&&!confirm(months[month-1]+' ist mit '+occupied.place+' nach '+shortArtist(occupied)+' belegt. Durch die aktuelle Auswahl ersetzen?'))return;
  if(occupied)state.items[occupied.id]={...value(occupied.id),month:null};
  state.items[active.id]={...value(active.id),month,layout};renderYear();persist();
});
$('atelier-months').addEventListener('click',event=>{
  const remove=event.target.closest('[data-remove]');
  if(remove){if(blocked)return;state.items[remove.dataset.remove]={...value(remove.dataset.remove),month:null};renderYear();persist();return;}
  const button=event.target.closest('[data-month]');if(!button)return;
  month=Number(button.dataset.month);
  if(button.dataset.id){active=byId.get(button.dataset.id);city=active.place_slug;layout=value(active.id).layout;}
  render();$('entwurf').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
});
$('atelier-export').addEventListener('click',()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)+'\n'],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='Toskana-2027-Auswahl.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$('open-origins').addEventListener('click',()=>{
  $('origins-content').innerHTML=`<figure><img src="${escape(asset(active.photo_asset))}" alt="${escape(active.source_caption)}"><figcaption><h3>Unser Foto aus ${escape(active.place)}</h3><p>${escape(active.source_caption)}</p></figcaption></figure><figure><img src="${escape(asset(active.reference_asset))}" alt="${escape(active.reference.title)}"><figcaption><h3>${escape(active.artist.name)}</h3><p>„${escape(active.reference.title)}“, ${escape(active.reference.year)}</p><a href="${escape(active.reference.source)}" target="_blank" rel="noopener">${escape(active.reference.source_label)}</a></figcaption></figure>`;
  $('origins-dialog').showModal();
});
$('enlarge-preview').addEventListener('click',()=>$('preview-dialog').showModal());
$('atelier-print').addEventListener('click',()=>window.print());
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
window.addEventListener('storage',event=>{if(event.key===storageKey&&!local){blocked=true;message('Die Auswahl wurde in einem anderen Fenster geändert. Bitte neu laden.');}});
render();
})();
