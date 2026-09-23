'use strict';
(() => {
const $ = id => document.getElementById(id);
const catalog = JSON.parse($('atelier-catalog').textContent);
const sources = JSON.parse($('atelier-sources').textContent);
const policy = JSON.parse($('selection-policy').textContent);
const rules = window.CalendarSelectionRules;
const prefix = document.body.dataset.prefix;
const local = document.body.dataset.mode === 'local';
const storageKey = 'toskana-2027-selection-v1';
const byId = new Map(catalog.map(item => [item.id, item]));
const months = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const weekdays = ['Mo','Di','Mi','Do','Fr','Sa','So'];
const layouts = [
  {id:'leiste', name:'Die klare Leiste', short:'Das ganze Bild oben. Tage und QR unten.', description:'Das ganze Bild bleibt sichtbar, ohne Beschnitt oder Verzerrung. Je nach Bildformat bleibt seitlich oder oben und unten Weißraum. Titel, Tagesleiste und QR-Code stehen darunter.'},
  {id:'lichtband', name:'Das Lichtband', short:'Ein helles Band direkt im Bild.', description:'Titel und Tage liegen auf einem durchscheinenden weißen Band. Der QR-Code bleibt auf reinem Weiß. Das Bild wird für die große Fläche beschnitten.'},
  {id:'seitenrand', name:'Der Seitenrand', short:'Das ganze Bild. Der Monat daneben.', description:'Das Bild bleibt vollständig sichtbar. Rechts stehen der Monat als Wochenraster und darunter der QR-Code.'},
  {id:'schwebend', name:'Die schwebende Karte', short:'Ein Monatsraster über der Bildkante.', description:'Eine weiße Kalenderkarte überlappt den unteren Bildrand. Der QR-Code sitzt neben dem Wochenraster. Das Bild wird leicht beschnitten.'}
];
const layoutById = new Map(layouts.map(x => [x.id,x]));
const defaults = () => ({favorite:false,stars:0,note:'',month:null,layout:'leiste'});
let state = JSON.parse($('atelier-state').textContent), blocked = false, queue = Promise.resolve(), lastCalendarRaw=null;
const value = id => ({...defaults(),...state.items[id]});
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const asset = path => prefix + 'assets/' + path;
const curated = item => !policy.preferred_artists[item.place_slug] || policy.preferred_artists[item.place_slug].includes(item.artist.slug);
const clashes = item => {
  const result=rules.conflicts(item,month,state,catalog,policy.cover_image_id);
  const instagram=window.InstagramCalendarGuard?.conflict(item.source_id);
  if(instagram)result.push({kind:'instagram',label:instagram});
  return result;
};
const offered = item => $('show-all-variants').checked || (curated(item) && !clashes(item).length);
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
  const saved = local ? null : localStorage.getItem(storageKey);lastCalendarRaw=saved;
  state = validState(saved ? JSON.parse(saved) : state);
} catch(error) {
  blocked=true;
  $('atelier-save-status').textContent=error.message+' Bitte den bestehenden Stand in der Bildauswahl prüfen.';
}
const params = new URLSearchParams(location.search);
const linkedImage = byId.get(params.get('bild'));
let month = Number(params.get('monat'));
if(!Number.isInteger(month)||month<1||month>12) month=linkedImage?(value(linkedImage.id).month||linkedImage.suggested_month):nextOpenMonth()||1;
const linkedSource=sources.find(s=>s.id===params.get('foto')&&(!params.get('ort')||s.place_slug===params.get('ort')));
let active = linkedImage || (!linkedSource&&!params.get('ort')?catalog.find(i=>value(i.id).month===month):null) || null;
let city = active?.place_slug || linkedSource?.place_slug || (sources.some(s=>s.place_slug===params.get('ort'))?params.get('ort'):'');
let photo = active?.source_id || linkedSource?.id || '', artist = active?.artist.slug || '';
let layout = layoutById.has(params.get('layout')) ? params.get('layout') : active?value(active.id).layout:'leiste';
const ready = () => !!active && active.place_slug===city && active.source_id===photo && active.artist.slug===artist;
const cities = [...new Map(sources.map(item=>[item.place_slug,item.place])).entries()];
cities.sort((a,b)=>a[1].localeCompare(b[1],'de'));
function nextOpenMonth(after=0) {return Array.from({length:12},(_,i)=>(after+i)%12+1).find(m=>!catalog.some(i=>value(i.id).month===m));}
function chooseMonth(nextMonth) {
  month=nextMonth;active=catalog.find(i=>value(i.id).month===month)||null;
  city=active?.place_slug||'';photo=active?.source_id||'';artist=active?.artist.slug||'';layout=active?value(active.id).layout:'leiste';
  if(!blocked)message('');render();
}
function placeUsage(slug) {
  if(byId.get(policy.cover_image_id)?.place_slug===slug)return 'Titelseite';
  const used=catalog.find(i=>i.place_slug===slug&&value(i.id).month&&value(i.id).month!==month&&(!ready()||i.id!==active.id));
  return used?months[value(used.id).month-1]:null;
}
function renderFlow() {
  const assigned=catalog.find(i=>value(i.id).month===month);
  const saved=ready()&&assigned?.id===active.id&&value(active.id).layout===layout;
  for(const option of $('atelier-month').options) {
    const item=catalog.find(i=>value(i.id).month===Number(option.value));
    option.textContent=months[Number(option.value)-1]+(item?' · '+item.place+' / '+shortArtist(item):' · noch offen');
  }
  $('atelier-month').value=month;
  $('month-hint').textContent=assigned?'Gespeichert: '+assigned.place+' nach '+shortArtist(assigned)+'. Du kannst diese Auswahl bearbeiten.':'Für '+months[month-1]+' ist noch kein Motiv gespeichert.';
  $('city-select').innerHTML='<option value="">Ort wählen …</option>'+cities.map(([slug,name])=>{
    const used=placeUsage(slug);
    return `<option value="${escape(slug)}" ${used?'disabled':''}>${escape(name+(used?' · belegt: '+used:''))}</option>`;
  }).join('');
  $('city-select').value=city;
  $('city-hint').textContent=city?(placeUsage(city)?'Dieser Ort ist bereits für '+placeUsage(city)+' reserviert.':months[month-1]+' bleibt gewählt. Jetzt ein Ausgangsfoto aussuchen.'):'Jeder Ort einmal. Vergebene Orte sind gesperrt; im Jahresplan kannst du sie bearbeiten.';
  const citySources=sources.filter(s=>s.place_slug===city);
  const videoStills=citySources.filter(s=>s.source_type==='video-frame').length;
  const sourceCount=videoStills?`${citySources.length-videoStills} Fotos · ${videoStills} Videostandbilder`:`${citySources.length} Originalfotos`;
  const currentSource=citySources.find(s=>s.id===photo);
  $('source-select').disabled=!city;
  $('source-select').innerHTML=`<option value="">${city?'Foto wählen …':'Zuerst einen Ort wählen'}</option>`+citySources.map((s,index)=>`<option value="${escape(s.id)}">${index+1}. ${escape(s.caption)}${window.InstagramCalendarGuard.conflict(s.id)?' · für Instagram gewählt':''}</option>`).join('');
  $('source-select').value=photo;
  $('source-hint').textContent=currentSource?(window.InstagramCalendarGuard.conflict(photo)||'Ausgewählt: '+currentSource.caption):city?sourceCount+' · unten auch als Bildvorschau.':'Erst den Ort, dann das konkrete Foto wählen.';
  $('source-choice').hidden=!city;
  $('source-description').textContent=sourceCount+(currentSource?' · Ausgewählt: '+currentSource.caption:' · Klicke auf ein Bild. Danach den Maler in Schritt 4 wählen.');
  $('instagram-link').href='#atelier-instagram';
  $('source-options').innerHTML=citySources.map(s=>{
    const variants=catalog.filter(i=>i.source_id===s.id);
    return `<button type="button" class="source-option" data-source="${escape(s.id)}" aria-pressed="${s.id===photo}" aria-label="${escape(s.caption+' als Ausgangsfoto wählen')}"><img src="${escape(asset(s.asset))}" alt="${escape(s.caption)}" loading="lazy"><strong>${s.id===photo?'✓ ':''}${escape(s.caption)}</strong><span>${window.InstagramCalendarGuard.conflict(s.id)?'Für Instagram gewählt · ':''}${variants.length} gemalte Varianten · ${escape(s.filename)}</span></button>`;
  }).join('');
  const choices=catalog.filter(i=>i.source_id===photo&&($('show-all-variants').checked||curated(i)||i.artist.slug===artist));
  const painters=[...new Map(choices.map(i=>[i.artist.slug,i])).values()];
  $('artist-select').disabled=!photo;
  $('artist-select').innerHTML=`<option value="">${photo?'Maler wählen …':'Zuerst ein Foto wählen'}</option>`+painters.map(i=>{
    const conflict=clashes(i)[0];
    return `<option value="${escape(i.artist.slug)}" ${conflict?'disabled':''}>${escape(i.artist.name+(conflict?' · belegt: '+(conflict.kind==='instagram'?'Instagram':conflict.month==='cover'?'Titel':months[conflict.month-1]):''))}</option>`;
  }).join('');
  $('artist-select').value=artist;
  $('artist-hint').textContent=ready()?'Darunter kannst du die Farbvarianten dieses Fotos vergleichen.':photo?(painters.length?'Wähle die Handschrift für genau dieses Foto.':'Für dieses Foto sind nur frühere Malervarianten verfügbar. Aktiviere den Archivschalter oder wähle ein anderes Foto.'):'Die passenden Maler erscheinen nach der Fotoauswahl.';
  $('flow-summary').textContent=(ready()?(saved?'Gespeichert: ':'Noch nicht gespeichert: '):'Deine Auswahl: ')+months[month-1]+' → '+(cities.find(([slug])=>slug===city)?.[1]||'Ort wählen')+' → '+(currentSource?.caption||'Foto wählen')+' → '+(ready()?shortArtist(active):'Maler wählen');
  $('flow-summary').classList.toggle('is-saved',saved);
  $('flow-empty').hidden=ready();
  $('flow-empty').textContent=!city?'Wähle in Schritt 2 einen Ort für '+months[month-1]+'.':!photo?'Wähle in Schritt 3 oder in den Vorschauen darunter dein Ausgangsfoto.':'Foto gewählt. Jetzt in Schritt 4 einen Maler wählen.';
  $('motif-choice').hidden=!ready();$('entwurf').hidden=!ready();$('layout-chooser').hidden=!ready();$('vergleich').hidden=!city;
  $('next-month').hidden=!saved||!nextOpenMonth();
  $('move-choice').hidden=!saved;
  for(const option of $('move-month').options)option.disabled=Number(option.value)===month;
  if(Number($('move-month').value)===month)$('move-month').value='';
  $('prepare-move').disabled=!$('move-month').value;
  $('draft-label').textContent=months[month-1]+' 2027 · '+(saved?'Gespeichert':'Dein Entwurf');
  $('chosen-layout').textContent=layoutById.get(layout).name;
  const url=new URL(location.href);url.searchParams.set('monat',month);
  if(ready()){url.searchParams.set('bild',active.id);url.searchParams.set('layout',layout);}
  else{url.searchParams.delete('bild');url.searchParams.delete('layout');}
  if(city)url.searchParams.set('ort',city);else url.searchParams.delete('ort');
  if(photo)url.searchParams.set('foto',photo);else url.searchParams.delete('foto');
  history.replaceState(null,'',url);
}
function message(text) { $('atelier-save-status').textContent=text; }
function persist() {
  if(blocked) {message('Speichern angehalten. Auswahl exportieren und Seite neu laden.');return;}
  try {rules.assertUnique(state,catalog,policy.cover_image_id);}
  catch(error) {message('Bitte doppelte Belegungen im Jahresplan auflösen: '+error.message);return;}
  if(!local) {
    try {const saved=window.SelectionStorage.write(localStorage,storageKey,lastCalendarRaw,state);state=saved.state;lastCalendarRaw=saved.raw;message('In diesem Browser gespeichert.');}
    catch(error) {blocked=true;message(error.message+' Änderungen bei Bedarf exportieren, dann neu laden.');}
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
  if(!ready())return;
  $('large-preview').innerHTML=paper(layout,true);
  $('modal-preview').innerHTML=paper(layout,true);
  $('preview-label').textContent=active.place+' nach '+shortArtist(active);
  $('layout-caption').textContent=layoutById.get(layout).description;
  $('layout-options').innerHTML=layouts.map(l=>`<button type="button" class="layout-option" data-layout="${l.id}" aria-pressed="${layout===l.id}" aria-label="${l.name}: ${l.short}"><div class="paper-frame" aria-hidden="true">${paper(l.id)}</div><strong>${l.name}</strong><span>${l.short}</span></button>`).join('');
  $('save-combination').textContent='Für '+months[month-1]+' speichern';
  $('active-place').textContent=active.place;
  const source=sources.find(s=>s.id===active.source_id);
  $('active-motif').textContent=source ? source.caption : active.source_caption;
  $('active-reference').textContent='Nach „'+active.reference.title+'“, '+active.reference.year;
  const siblings=catalog.filter(x=>x.source_id===photo&&x.artist.slug===artist);
  $('motif-choice').hidden=siblings.length<2;
  $('motif-description').textContent=active.place+' nach '+active.artist.name+' · '+(siblings.length===1?'Eine Fassung ist vorbereitet.':siblings.length+' Farbvarianten für dasselbe Ausgangsfoto.');
  $('painter-options').innerHTML=siblings.map(item=>{
    const caption=item.palette||item.reference.title;
    return `<button type="button" class="motif-option" data-art="${escape(item.id)}" aria-pressed="${item.id===active.id}" aria-label="${escape(caption+' auswählen')}"><img src="${escape(asset(item.asset))}" alt="${escape(caption)}" loading="lazy"><strong>${item.id===active.id?'✓ Ausgewählte Variante':'Diese Variante ansehen'}</strong><span>${escape(caption)}</span></button>`;
  }).join('');
  $('favorite-combination').textContent=value(active.id).favorite?'♥ Als Favorit markiert':'♡ Bild als Favorit';
  $('favorite-combination').setAttribute('aria-pressed',String(value(active.id).favorite));
}
function renderMatrix() {
  if(!city)return;
  const allItems=catalog.filter(i=>i.place_slug===city);
  const onlyFavorites=$('only-favorites').checked;
  const items=allItems.filter(i=>offered(i)&&(!onlyFavorites||value(i.id).favorite));
  const artists=[...new Map(items.map(i=>[i.artist.slug,i])).values()];
  let rows=sources.filter(s=>s.place_slug===city);
  // Selected original photos are still available if a public export lacks extra sources.
  if(!rows.length) rows=[...new Map(items.map(i=>[i.source_id,{id:i.source_id,asset:i.photo_asset,caption:i.source_caption,filename:'Ausgangsfoto'}])).values()];
  rows.sort((a,b)=>Number(items.some(i=>i.source_id===b.id))-Number(items.some(i=>i.source_id===a.id)));
  rows=rows.filter(s=>items.some(i=>i.source_id===s.id));
  $('matrix-description').textContent=cities.find(([slug])=>slug===city)[1]+': '+items.length+($('show-all-variants').checked?' angezeigte Varianten (auch frühere und belegte)':' passende Varianten von '+artists.length+' Malern für '+months[month-1])+'. Insgesamt '+allItems.length+' Varianten im Archiv.';
  $('matrix-head').innerHTML='<tr><th scope="col">Unser Ausgangsfoto<small>Ein Motiv pro Zeile</small></th>'+artists.map(i=>`<th scope="col">${escape(i.artist.name)}<small>${escape(i.artist.movement)}</small></th>`).join('')+'</tr>';
  $('matrix-body').innerHTML=rows.map(source=>`<tr><th scope="row"><button type="button" class="photo-button" data-photo="${escape(source.id)}" aria-label="Ausgangsfoto ${escape(source.caption)} vergrößern"><img src="${escape(asset(source.asset))}" alt="${escape(source.caption)}" loading="lazy"></button><span class="source-caption">${escape(source.caption)}</span><span class="source-filename">${escape(source.filename || '')}</span></th>${artists.map(a=>{
    const variants=items.filter(i=>i.source_id===source.id&&i.artist.slug===a.artist.slug);
    if(!variants.length)return '<td><div class="pending-art">—<small>Andere Handschrift für dieses Motiv</small></div></td>';
    return '<td>'+variants.map(i=>`<button type="button" class="matrix-art ${clashes(i).length?'is-unavailable':''}" data-art="${escape(i.id)}" aria-pressed="${active?.id===i.id}" aria-label="${escape(source.caption+' nach '+i.artist.name+' auswählen')}"><img src="${escape(asset(i.asset))}" alt="${escape('KI-Variante nach '+i.artist.name)}" loading="lazy"><small class="matrix-reference">Nach „${escape(i.reference.title)}“</small><span>${clashes(i).length?escape(clashes(i).map(c=>c.label).join(' ')):active?.id===i.id?'In der Vorschau':'Im Kalender ansehen'} <b>${value(i.id).favorite?'♥':''}</b></span></button>`).join('')+'</td>';
  }).join('')}</tr>`).join('');
  $('no-favorites').hidden=rows.length>0;
  $('no-favorites').textContent=onlyFavorites?'Keine passenden Favoriten. Schalte den Favoritenfilter aus oder öffne die früheren und belegten Varianten.':'Für '+months[month-1]+' ist hier kein freier Vorschlag verfügbar. Wähle einen anderen Ort oder bearbeite die Belegung im Jahresplan.';
}
function renderAvailability() {
  const assigned=catalog.filter(i=>value(i.id).month);
  const cover=byId.get(policy.cover_image_id);
  const occupied=cover?[cover,...assigned]:assigned;
  const artists=[...new Map(catalog.map(i=>[i.artist.slug,i])).values()].sort((a,b)=>a.artist.name.localeCompare(b.artist.name,'de'));
  $('diversity-summary').textContent=assigned.length+' von 12 Monatsmotiven gewählt'+(cover?' · Titel: '+cover.place+' / '+shortArtist(cover):'')+' · '+artists.length+' Maler zur Auswahl';
  $('artist-availability').innerHTML=artists.map(i=>{
    const used=occupied.find(x=>x.artist.slug===i.artist.slug);
    return `<span class="artist-chip ${used?'is-used':''}"><strong>${escape(shortArtist(i))}</strong><small>${used?escape(used===cover?'Titel · '+used.place:months[value(used.id).month-1]+' · '+used.place):'frei'}</small></span>`;
  }).join('');
  const conflicts=ready()?clashes(active):[];
  $('save-combination').disabled=blocked||!ready()||conflicts.length>0;
  $('combination-availability').classList.toggle('is-conflict',conflicts.length>0);
  $('combination-availability').textContent=conflicts.length?conflicts.map(c=>c.label).join(' ')+(conflicts.some(c=>c.kind==='instagram')?'':conflicts.some(c=>c.month==='cover')?' Für den Titel reserviert. Wähle einen anderen Ort und Maler.':' Gib die bisherige Belegung im Jahresplan frei, um neu zuzuordnen.'):'Ort und Maler sind für '+months[month-1]+' verfügbar.';
  if(ready()&&value(active.id).month&&value(active.id).month!==month&&!conflicts.length)$('combination-availability').textContent='Beim Speichern wird dieses Motiv von '+months[value(active.id).month-1]+' nach '+months[month-1]+' verschoben.';
}
function renderYear() {
  const count=catalog.filter(i=>value(i.id).month).length;
  $('year-count').textContent=count+' / 12';
  $('atelier-months').innerHTML=months.map((name,index)=>{
    const item=catalog.find(i=>value(i.id).month===index+1);
    return `<div class="year-month ${item?'is-assigned':''} ${month===index+1?'is-current':''}"><button type="button" class="year-open" data-month="${index+1}" ${item?`data-id="${escape(item.id)}"`:''} aria-label="${name}: ${item?escape(item.place+', bearbeiten'):'noch offen, gestalten'}"><strong>${name}</strong>${item?`<span class="month-art"><img src="${escape(asset(item.asset))}" alt=""><small>${escape(item.place)}<br>${escape(shortArtist(item))}<br>${layoutById.get(value(item.id).layout).name}</small></span>`:'<span class="empty-month">+ Motiv wählen</span>'}</button>${item?`<button type="button" class="year-remove" data-remove="${escape(item.id)}" aria-label="${name} wieder freigeben">×</button>`:''}</div>`;
  }).join('');
}
function renderInstagram() {
  window.AtelierInstagram?.update({city,month,calendar:state,draftId:ready()?active.id:null,calendarBlocked:blocked,
    getCalendar:async()=>{await queue;if(blocked)throw Error('Bitte zuerst die Kalenderauswahl prüfen und neu laden.');return state;}});
}
function render() {$('atelier-wallpaper').dataset.wallpaperId=active?.id||'';window.WallpaperSelection?.sync();renderFlow();renderPreview();renderMatrix();renderYear();renderAvailability();renderInstagram();}
function selectImage(id) {if(!byId.has(id))return;active=byId.get(id);city=active.place_slug;photo=active.source_id;artist=active.artist.slug;if(!blocked)message('');render();}
function openPhoto(source) {
  const box=$('lightbox');box.querySelector('img').src=asset(source.asset);box.querySelector('img').alt=source.caption;box.querySelector('p').textContent=source.caption;box.showModal();
}
$('layout-options').addEventListener('click',event=>{
  const button=event.target.closest('[data-layout]');if(!button)return;
  layout=button.dataset.layout;render();
  // Keep keyboard focus on the selected option after replacing the previews.
  $('layout-options').querySelector(`[data-layout="${layout}"]`).focus({preventScroll:true});
});
$('painter-options').addEventListener('click',event=>{const button=event.target.closest('[data-art]');if(button){selectImage(button.dataset.art);$('painter-options').querySelector(`[data-art="${active.id}"]`).focus({preventScroll:true});}});
$('matrix-body').addEventListener('click',event=>{
  const art=event.target.closest('[data-art]'),photo=event.target.closest('[data-photo]');
  if(art){selectImage(art.dataset.art);$('entwurf').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
  if(photo){const source=sources.find(s=>s.id===photo.dataset.photo);if(source)openPhoto(source);}
});
$('city-select').addEventListener('change',event=>{
  city=event.target.value;photo='';artist='';active=null;if(!blocked)message('');render();
});
function choosePhoto(id) {
  photo=sources.some(s=>s.id===id&&s.place_slug===city)?id:'';artist='';active=null;
  if(!blocked)message('');render();
}
$('source-select').addEventListener('change',event=>choosePhoto(event.target.value));
$('source-options').addEventListener('click',event=>{
  const button=event.target.closest('[data-source]');if(!button)return;
  choosePhoto(button.dataset.source);$('artist-select').focus({preventScroll:true});
});
$('artist-select').addEventListener('change',event=>{
  artist=event.target.value;active=catalog.find(i=>i.source_id===photo&&i.artist.slug===artist)||null;
  if(!blocked)message('');render();
});
$('atelier-month').addEventListener('change',event=>chooseMonth(Number(event.target.value)));
$('next-month').addEventListener('click',()=>{const next=nextOpenMonth(month);if(next){chooseMonth(next);$('auswahl-schritte').scrollIntoView({behavior:'instant'});$('city-select').focus({preventScroll:true});}});
$('move-month').addEventListener('change',()=>{$('prepare-move').disabled=!$('move-month').value;});
$('prepare-move').addEventListener('click',()=>{
  if(!ready()||!$('move-month').value)return;
  month=Number($('move-month').value);$('move-month').value='';if(!blocked)message('');render();
  $('auswahl-schritte').scrollIntoView({behavior:'instant'});
});
$('only-favorites').addEventListener('change',renderMatrix);
$('show-all-variants').addEventListener('change',render);
$('favorite-combination').addEventListener('click',()=>{if(blocked)return message('Bitte erst den Speicherstand prüfen.');state.items[active.id]={...value(active.id),favorite:!value(active.id).favorite};render();persist();});
$('save-combination').addEventListener('click',async()=>{
  if(blocked)return message('Bitte erst den Speicherstand prüfen.');
  if(!ready())return message('Bitte zuerst Monat, Ort, Foto und Maler wählen.');
  if(clashes(active).length)return message(clashes(active).map(c=>c.label).join(' '));
  const occupied=catalog.find(i=>i.id!==active.id&&value(i.id).month===month);
  if(occupied&&!confirm(months[month-1]+' ist mit '+occupied.place+' nach '+shortArtist(occupied)+' belegt. Durch die aktuelle Auswahl ersetzen?'))return;
  const next=JSON.parse(JSON.stringify(state));
  if(occupied)next.items[occupied.id]={...value(occupied.id),month:null};
  next.items[active.id]={...value(active.id),month,layout};
  const before=JSON.stringify(state);
  try {rules.assertUnique(next,catalog,policy.cover_image_id);await window.InstagramCalendarGuard.check(next,state);if(before!==JSON.stringify(state))throw Error('Die Auswahl wurde inzwischen geändert. Bitte erneut speichern.');} catch(error){return message(error.message);}
  state=next;render();persist();
});
$('atelier-months').addEventListener('click',event=>{
  const remove=event.target.closest('[data-remove]');
  if(remove){if(blocked)return;state.items[remove.dataset.remove]={...value(remove.dataset.remove),month:null};render();persist();return;}
  const button=event.target.closest('[data-month]');if(!button)return;
  chooseMonth(Number(button.dataset.month));$('auswahl-schritte').scrollIntoView({behavior:'instant'});$('atelier-month').focus({preventScroll:true});
});
$('atelier-export').addEventListener('click',()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)+'\n'],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='Toskana-2027-Auswahl.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$('open-origins').addEventListener('click',()=>{
  $('origins-content').innerHTML=`<figure><img src="${escape(asset(active.photo_asset))}" alt="${escape(active.source_caption)}"><figcaption><h3>Unser ${active.source_type==='video-frame'?'Videostandbild':'Foto'} aus ${escape(active.place)}</h3><p>${escape(active.source_caption)}</p></figcaption></figure><figure><img src="${escape(asset(active.reference_asset))}" alt="${escape(active.reference.title)}"><figcaption><h3>${escape(active.artist.name)}</h3><p>„${escape(active.reference.title)}“, ${escape(active.reference.year)}</p><a href="${escape(active.reference.source)}" target="_blank" rel="noopener">${escape(active.reference.source_label)}</a></figcaption></figure>`;
  $('origins-dialog').showModal();
});
$('enlarge-preview').addEventListener('click',()=>$('preview-dialog').showModal());
$('atelier-print').addEventListener('click',()=>window.print());
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
window.addEventListener('storage',event=>{if((event.key===storageKey||event.key===null)&&!local){blocked=true;renderAvailability();renderInstagram();message('Die Auswahl wurde in einem anderen Fenster geändert. Bitte neu laden.');}});
window.addEventListener('instagram-selection-change',()=>{renderFlow();renderAvailability();});
render();
if(location.hash==='#vergleich'&&city)$('vergleich').open=true;
try {rules.assertUnique(state,catalog,policy.cover_image_id);} catch(error){message('Im bisherigen Stand gibt es doppelte Belegungen. Bitte im Jahresplan auflösen: '+error.message);}
})();
