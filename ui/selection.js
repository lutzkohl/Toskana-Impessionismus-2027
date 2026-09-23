'use strict';
(() => {
const catalog = JSON.parse(document.getElementById('catalog-data').textContent);
const initial = JSON.parse(document.getElementById('selection-data').textContent);
const policy = JSON.parse(document.getElementById('selection-policy').textContent);
const rules = window.CalendarSelectionRules;
const instagram = window.InstagramCalendarGuard;
const local = document.body.dataset.mode === 'local';
const prefix = document.body.dataset.prefix;
const months = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const key = 'toskana-2027-selection-v1';
const byId = new Map(catalog.map(x=>[x.id,x]));
let state = initial, queue = Promise.resolve(), blocked = false, toastTimer;
const clone = x => JSON.parse(JSON.stringify(x));
const defaults = () => ({favorite:false,stars:0,note:'',month:null,layout:'leiste'});
const value = id => state.items[id] || defaults();
const status = document.getElementById('save-status');
const previewURL = (item, month) => state.items[item.id]?.layout ? prefix+'atelier/?bild='+encodeURIComponent(item.id)+'&monat='+month+'&layout='+encodeURIComponent(value(item.id).layout) : prefix+'kalender/'+item.id+'/'+month+'/';
function tell(text) { const t=document.getElementById('toast');t.textContent=text;t.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('visible'),5000); }
function valid(s,enforceUnique=false) {
  if(!s || s.version!==1 || s.year!==2027 || !s.items || typeof s.items!=='object' || Array.isArray(s.items)) throw Error('Bitte eine gültige Auswahl für 2027 verwenden.');
  const used=new Set(), result={version:1,year:2027,revision:state.revision,items:{}};
  for(const [id,raw] of Object.entries(s.items)) {
    if(!byId.has(id) || !raw || typeof raw!=='object' || Array.isArray(raw)) throw Error('Die Datei enthält ein unbekanntes Bild.');
    const v={...defaults(),...raw};
    if(v.month!==null && (!Number.isInteger(v.month)||v.month<1||v.month>12)) throw Error('Ein Monat ist ungültig.');
    if(v.month!==null && used.has(v.month)) throw Error('Ein Monat ist mehrfach belegt.');
    if(v.month!==null) used.add(v.month);
    if(!Number.isInteger(v.stars)||v.stars<0||v.stars>5||typeof v.favorite!=='boolean'||typeof v.note!=='string'||v.note.length>2000) throw Error('Bewertung oder Notiz ist ungültig.');
    if(!['leiste','lichtband','seitenrand','schwebend'].includes(v.layout)) throw Error('Die Blattgestaltung ist unbekannt.');
    result.items[id]={favorite:v.favorite,stars:v.stars,note:v.note,month:v.month,layout:v.layout};
  }
  if(enforceUnique)rules.assertUnique(result,catalog,policy.cover_image_id);
  return result;
}
if(!local) {
  try {const saved=localStorage.getItem(key);if(saved) state=valid(JSON.parse(saved));}
  catch(e){blocked=true;status.textContent='Die gespeicherte Auswahl konnte nicht geladen werden: '+e.message;}
}
function persist() {
  if(blocked) {tell('Bitte die Seite neu laden. Änderungen vorher als Auswahl exportieren.');return;}
  try {rules.assertUnique(state,catalog,policy.cover_image_id);}
  catch(error){status.textContent='Bitte doppelte Belegungen auflösen: '+error.message;tell(status.textContent);return;}
  if(!local) {
    try {localStorage.setItem(key,JSON.stringify(state));status.textContent='In diesem Browser gespeichert.';}
    catch(e){status.textContent='Speichern im Browser nicht möglich. Bitte die Auswahl exportieren.';tell(status.textContent);}
    return;
  }
  const snapshot=clone(state);
  status.textContent='Wird gespeichert …';
  queue=queue.then(async()=>{
    if(blocked) return;
    snapshot.revision=state.revision;
    const response=await fetch(prefix+'api/kalender/auswahl',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(snapshot)});
    const data=await response.json();
    if(!response.ok) throw Error(data.error || 'Speichern fehlgeschlagen.');
    state.revision=data.revision;
    status.textContent='Im Projekt gespeichert.';
  }).catch(e=>{blocked=true;status.textContent=e.message+' Änderungen mit „Auswahl exportieren“ sichern, dann neu laden.';tell(status.textContent);});
}
function render() {
  const board=document.getElementById('month-board');board.replaceChildren();
  let count=0;
  months.forEach((month,index)=>{
    const item=catalog.find(i=>value(i.id).month===index+1);
    const slot=document.createElement(item?'a':'button');slot.className='month-slot'+(item?' assigned':'');
    const label=document.createElement('strong');label.textContent=month;slot.append(label);
    if(item) {count++;slot.href=previewURL(item,index+1);const img=document.createElement('img');img.src=prefix+'assets/'+item.asset;img.alt='';slot.append(img);const place=document.createElement('em');place.textContent=item.place;slot.append(place);slot.setAttribute('aria-label',month+': '+item.place+', Kalenderblatt ansehen');}
    else {slot.type='button';const plus=document.createElement('span');plus.textContent='+';slot.append(plus);slot.setAttribute('aria-label',month+': noch offen');slot.addEventListener('click',()=>{tell('Wähle unten bei einem Bild unter „Bewerten & zuordnen“ den Monat '+month+'.');document.querySelector('.art-grid').scrollIntoView({behavior:'smooth'});});}
    board.append(slot);
  });
  document.getElementById('selection-count').textContent=count+' von 12 Monaten belegt';
  let visible=0;
  const filter=document.getElementById('filter').value;
  document.querySelectorAll('.art-card').forEach(card=>{
    const item=byId.get(card.dataset.id),v=value(item.id);
    const fav=card.querySelector('.favorite');fav.setAttribute('aria-pressed',String(v.favorite));fav.textContent=v.favorite?'♥':'♡';fav.setAttribute('aria-label',item.place+(v.favorite?' aus Favoriten entfernen':' als Favorit markieren'));
    card.querySelector('.month-select').value=v.month||'';card.querySelector('.rating').value=v.stars;
    for(const option of card.querySelector('.month-select').options) {
      const conflicts=option.value?rules.conflicts(item,Number(option.value),state,catalog,policy.cover_image_id):[];
      option.disabled=conflicts.length>0||!!(option.value&&instagram.conflict(item.source_id));
      option.title=conflicts.map(c=>c.label).join(' ');
    }
    let availability=card.querySelector('.assignment-availability');
    if(!availability){availability=document.createElement('p');availability.className='assignment-availability';card.querySelector('.month-select').closest('label').after(availability);}
    const conflicts=rules.conflicts(item,v.month||item.suggested_month,state,catalog,policy.cover_image_id);
    availability.textContent=[...conflicts.map(c=>c.label),instagram.conflict(item.source_id)].filter(Boolean).join(' ');
    availability.hidden=!availability.textContent;
    if(document.activeElement!==card.querySelector('.note')) card.querySelector('.note').value=v.note;
    card.querySelector('.preview-link').href=previewURL(item,v.month||item.suggested_month);
    card.hidden=(filter==='favorite'&&!v.favorite)||(filter==='assigned'&&!v.month);
    if(!card.hidden)visible++;
  });
  document.getElementById('empty-filter').hidden=visible>0;
}
function update(id,patch) {if(blocked)return tell('Bitte erst den Speicherstand prüfen.');state.items[id]={...value(id),...patch};render();persist();}
document.querySelectorAll('.art-card').forEach(card=>{
  const id=card.dataset.id;
  card.querySelector('.favorite').addEventListener('click',()=>update(id,{favorite:!value(id).favorite}));
  card.querySelector('.rating').addEventListener('change',e=>update(id,{stars:Number(e.target.value)}));
  card.querySelector('.note').addEventListener('change',e=>update(id,{note:e.target.value}));
  card.querySelector('.month-select').addEventListener('change',async e=>{
    if(blocked){render();return tell('Bitte erst den Speicherstand prüfen.');}
    const month=e.target.value?Number(e.target.value):null;
    const conflicts=month?rules.conflicts(byId.get(id),month,state,catalog,policy.cover_image_id):[];
    if(conflicts.length){render();return tell(conflicts.map(c=>c.label).join(' '));}
    const occupied=month?catalog.find(i=>i.id!==id && value(i.id).month===month):null;
    if(occupied && !confirm(months[month-1]+' ist mit '+occupied.place+' belegt. Durch '+byId.get(id).place+' ersetzen?')) {render();return;}
    const next=clone(state);
    if(occupied)next.items[occupied.id]={...value(occupied.id),month:null};
    next.items[id]={...value(id),month};
    if(month){try{const before=JSON.stringify(state);rules.assertUnique(next,catalog,policy.cover_image_id);await instagram.check(next,state);if(before!==JSON.stringify(state))throw Error('Die Auswahl wurde inzwischen geändert. Bitte erneut wählen.');}catch(error){render();return tell(error.message);}}
    state=next;render();persist();
  });
});
document.getElementById('filter').addEventListener('change',render);
document.getElementById('export-selection').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify(state,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='Toskana-2027-Auswahl.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
document.getElementById('open-import').addEventListener('click',()=>document.getElementById('import-selection').click());
document.getElementById('import-selection').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  try {if(blocked)throw Error('Bitte erst den Speicherstand prüfen.');if(file.size>100000)throw Error('Die Auswahldatei ist zu groß.');const imported=valid(JSON.parse(await file.text()),true);await instagram.check(imported,state);if(Object.keys(state.items).length && !confirm('Die aktuelle Auswahl durch die importierte Auswahl ersetzen?'))return;state=imported;render();persist();tell('Auswahl übernommen.');}
  catch(error){tell(error.message);}
  finally{e.target.value='';}
});
render();
try {rules.assertUnique(state,catalog,policy.cover_image_id);} catch(error){status.textContent='Im bisherigen Stand gibt es doppelte Belegungen. Bitte die Monatszuordnung korrigieren: '+error.message;}
window.addEventListener('storage',event=>{if(event.key===key&&!local){blocked=true;status.textContent='Die Auswahl wurde in einem anderen Fenster geändert. Bitte neu laden.';}});
window.addEventListener('storage',event=>{if(event.key==='toskana-2027-instagram-v1'&&!local)render();});
})();
