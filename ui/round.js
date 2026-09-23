'use strict';
(() => {
  const $=id=>document.getElementById(id),I=window.InstagramCore,R=window.RoundCore;
  const read=id=>JSON.parse($(id).textContent),catalog=read('round-catalog'),pool=read('round-pool'),sources=read('round-source-data'),policy=read('round-policy');
  const args=[catalog,pool,sources,policy],prefix=document.body.dataset.prefix,local=document.body.dataset.mode==='local';
  const months=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  const labels={calendar:'Kalender',instagram:'Instagram',skipped:'Übersprungen',open:'Noch offen'},states={done:'✓ Abgeschlossen',changed:'↻ Erneut prüfen',open:'○ Offen'};
  const keys={calendar:'toskana-2027-selection-v1',instagram:'toskana-2027-instagram-v1',workflow:'toskana-2027-round-v1'};
  const byId=new Map(pool.map(i=>[i.id,i])),bySource=new Map(sources.map(s=>[s.id,s]));
  const cities=[...new Map(sources.map(s=>[s.place_slug,s.place])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'de'));
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const asset=i=>prefix+'assets/'+I.safeAsset(i.asset),clone=x=>JSON.parse(JSON.stringify(x));
  let state=read('round-state'),lastRaw={},busy=false,blocked=false,invalid=null,imported=null;
  const query=new URLSearchParams(location.search);
  let month=Math.min(12,Math.max(1,Number(query.get('monat'))||1)),scope=query.get('modus')==='vorrat'?'reserve':'month';
  let step=query.get('schritt')==='instagram'?'instagram':'calendar',city='',activeId='';
  function say(text){$('round-save-status').textContent=text;}
  function alert(text){$('round-alert').textContent=text;$('round-alert').hidden=!text;}
  function download(name,data){const blob=new Blob([typeof data==='string'?data:JSON.stringify(data,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
  function readBrowser(){
    const next=read('round-state');
    for(const part of Object.keys(keys)){lastRaw[part]=localStorage.getItem(keys[part]);if(lastRaw[part]!==null)next[part]=JSON.parse(lastRaw[part]);}
    return next;
  }
  try{state=R.validateBundle(local?state:readBrowser(),...args);}
  catch(e){invalid=local?state:Object.fromEntries(Object.entries(keys).map(([part,key])=>[part,lastRaw[part]??null]));blocked=true;alert(e.message+' Die bisherige Auswahl bleibt erhalten. Konflikte lassen sich in der Instagram-Auswahl bearbeiten. Die Gesamtsicherung kann trotzdem heruntergeladen werden.');state=read('round-state');state.calendar={version:1,year:2027,revision:0,items:{}};state.instagram=I.emptySelection();state.workflow=R.emptyWorkflow();}
  function calendarArt(){return R.calendarItem(state,month,catalog);}
  function assignedPlace(slug){return catalog.find(i=>i.place_slug===slug&&state.calendar.items[i.id]?.month);}
  function availableCities(){return scope==='reserve'?cities.filter(([slug])=>!assignedPlace(slug)):cities;}
  function setContext(){
    const art=calendarArt();city=scope==='reserve'?(availableCities()[0]?.[0]||''):(art?.place_slug||state.workflow.drafts[month]||'');
    if(art&&scope==='month')activeId=art.id;else activeId='';
  }
  setContext();
  if(availableCities().some(([slug])=>slug===query.get('ort')))city=query.get('ort');
  if(byId.get(query.get('bild'))?.place_slug===city)activeId=query.get('bild');
  function citySources(){return sources.filter(s=>s.place_slug===city);}
  function selectedFor(sourceId){return pool.find(i=>i.source_id===sourceId&&state.instagram.items[i.id]?.selected);}
  function sourceVariants(id){return pool.filter(i=>i.source_id===id&&(i.kind==='painting'||state.instagram.items[i.id]?.selected));}
  function candidates(){
    if(step==='instagram'||scope==='reserve')return sourceVariants(byId.get(activeId)?.source_id||citySources()[0]?.id);
    return pool.filter(i=>i.place_slug===city&&i.kind==='painting');
  }
  function active(){return byId.get(activeId);}
  function ensureActive(){
    if(active()?.place_slug!==city){const s=citySources()[0];activeId=s?(selectedFor(s.id)?.id||sourceVariants(s.id)[0]?.id||''):'';}
  }
  function disabled(){return busy||blocked;}
  function calendarError(item){
    if(!item||item.kind!=='painting')return 'Bitte eine gemalte Fassung wählen.';
    if(scope==='reserve')return 'Zusatzvorrat: Dieses Motiv bekommt keinen Kalendermonat.';
    const assigned=state.calendar.items[item.id]?.month;
    if(assigned&&assigned!==month)return 'Dieses Bild ist bereits im '+months[assigned-1]+' gewählt.';
    const art=catalog.find(i=>i.id===item.id),clashes=window.CalendarSelectionRules.conflicts(art,month,state.calendar,catalog,policy.cover_image_id);
    if(clashes.length)return clashes.map(c=>c.label).join(' ');
    if(selectedFor(item.source_id))return 'Dieses Motiv ist für Instagram gewählt. Hier zuerst abwählen, um es in den Kalender zu übernehmen.';
    return '';
  }
  function usage(item){
    const occupied=I.calendarSources(state.calendar,pool,policy).get(item.source_id);
    if(occupied)return occupied.map(x=>x.kind==='cover'?'Titelseite':'Kalender · '+months[x.month-1]).join(', ');
    const chosen=selectedFor(item.source_id);return chosen?(chosen.id===item.id?'✓ Für Instagram gewählt':'Instagram · '+(chosen.artist||'Originalfoto')):state.workflow.skipped.includes(item.source_id)?'Bewusst übersprungen':'Noch nicht verwendet';
  }
  function updateUrl(){const url=new URL(location.href);url.searchParams.set('monat',month);url.searchParams.set('modus',scope==='reserve'?'vorrat':'monat');url.searchParams.set('schritt',step);if(city)url.searchParams.set('ort',city);else url.searchParams.delete('ort');if(activeId)url.searchParams.set('bild',activeId);else url.searchParams.delete('bild');history.replaceState(null,'',url);}
  function renderSidebar(){
    $('round-months').innerHTML=months.map((name,n)=>{const m=n+1,art=R.calendarItem(state,m,catalog),status=R.monthStatus(state,m,...args);return `<button type="button" data-month="${m}" aria-current="${scope==='month'&&month===m}"><strong>${status==='done'?'✓ ':status==='changed'?'↻ ':''}${String(m).padStart(2,'0')} · ${name}</strong><span>${esc(art?.place||state.workflow.drafts[m]&&cities.find(([c])=>c===state.workflow.drafts[m])?.[1]||'Ort noch offen')}</span></button>`;}).join('');
    $('round-reserve').setAttribute('aria-current',String(scope==='reserve'));
  }
  function renderArt(){
    const item=active(),empty=!item,chosen=item?selectedFor(item.source_id):null,value=item?state.instagram.items[item.id]||{}:{};
    $('round-enlarge').disabled=empty;
    if(item){$('round-art').src=asset(item);$('round-art').alt=item.title+' – '+item.artist;}else{$('round-art').removeAttribute('src');$('round-art').alt='Wähle einen Ort, um die Bilder zu vergleichen.';}
    $('round-use').textContent=item?usage(item):'Deine Monatsrunde';
    $('round-artist').textContent=item?(item.artist||'Originalfoto'):'Ort auswählen';
    $('round-caption').textContent=item?(item.palette||bySource.get(item.source_id)?.caption||item.title):'Alle Entscheidungen werden nach jeder Auswahl gesichert.';
    const list=candidates();$('round-counter').textContent=item?'Fassung '+(list.findIndex(i=>i.id===item.id)+1)+' / '+list.length:'';
    const source=item&&bySource.get(item.source_id);$('round-source-kind').textContent=source?.source_type==='video-frame'?'Videostandbild · Originalclip lokal vorhanden':source?.filename||'';
    $('round-variants').innerHTML=item?sourceVariants(item.source_id).map(i=>`<button type="button" data-variant="${esc(i.id)}" aria-pressed="${i.id===item.id}">${esc(i.artist||'Originalfoto')}<small>${esc(i.palette||'')}${state.instagram.items[i.id]?.selected?' · ✓':''}</small></button>`).join(''):'';
    const conflict=calendarError(item),isCalendar=item&&state.calendar.items[item.id]?.month===month;
    $('round-conflict').textContent=step==='calendar'&&scope==='month'?conflict:'';
    $('round-calendar').hidden=scope==='reserve';$('round-calendar').disabled=disabled()||!!conflict||isCalendar;
    $('round-calendar').textContent=isCalendar?'✓ Kalenderbild für '+months[month-1]:'Für '+months[month-1]+' in den Kalender';
    $('round-layout').hidden=!item||scope==='reserve';$('round-layout').href=prefix+'atelier/?monat='+month+'&ort='+encodeURIComponent(city)+'&bild='+encodeURIComponent(activeId)+'&foto='+encodeURIComponent(item?.source_id||'')+'&layout='+encodeURIComponent(state.calendar.items[activeId]?.layout||'leiste');
    const occupied=item&&I.calendarSources(state.calendar,pool,policy).has(item.source_id),selected=!!value.selected;
    $('round-instagram').disabled=disabled()||empty||!!occupied;
    $('round-instagram').setAttribute('aria-pressed',String(selected));
    $('round-instagram').textContent=occupied?'Kalendermotiv · für Instagram gesperrt':selected?'✓ Instagram gewählt · abwählen':chosen?'Diese Fassung für Instagram nehmen':'Für Instagram wählen';
    $('round-format-fields').hidden=!selected;
    $('round-format').innerHTML=item?Object.entries(I.formats).filter(([key])=>!key.startsWith('swipe')||item.width>item.height).map(([key,label])=>`<option value="${key}" ${key===(value.format||'original')?'selected':''}>${esc(label)}${key==='swipe-'+I.recommendedSegments(item.width,item.height)?' · empfohlen':''}</option>`).join(''):'';
    $('round-format').disabled=disabled();$('round-note').disabled=disabled();$('round-note').value=value.note||'';
    $('round-format-help').textContent=(value.format||'').startsWith('swipe')?'Ein Beitrag, '+(Number(value.format.slice(-1))+1)+' Seiten. Abschluss: ganzes Gemälde mit Rand.':'Ein Beitrag. Im Originalformat bleibt das ganze Bild erhalten.';
    $('round-skip').disabled=disabled()||empty||!!chosen||!!occupied;
    $('round-skip').textContent=item&&state.workflow.skipped.includes(item.source_id)?'Überspringen rückgängig machen':'Motiv bewusst überspringen';
    $('round-story').hidden=!item||item.kind!=='painting';$('round-story').href=prefix+'bilder/'+encodeURIComponent(activeId)+'/';
    $('round-prev').disabled=list.length<2;$('round-next').disabled=list.length<2;
    $('round-filmstrip').innerHTML=selected?I.slides(item.width,item.height,value.format||'original',value.final_frame||'full').map((slide,n)=>{const d=slide.draw;return `<div class="round-slide"><span class="round-slide-window" style="aspect-ratio:${slide.width}/${slide.height}"><img src="${esc(asset(item))}" alt="Beitragsseite ${n+1}" style="left:${d.x/slide.width*100}%;top:${d.y/slide.height*100}%;width:${d.width/slide.width*100}%;height:${d.height/slide.height*100}%"></span>${n+1} · ${slide.kind==='full'?'Gesamtbild':slide.kind==='panorama'?'Panorama':slide.kind==='crop'?'Ausschnitt':'Original'}</div>`;}).join(''):'';
    if($('round-dialog').open)renderDialog();
  }
  function renderSources(){
    const list=citySources(),open=list.filter(s=>R.sourceStatus(state,s.id,pool,policy)==='open').length;
    $('round-progress').textContent=list.length?(list.length-open)+' / '+list.length+' Motive entschieden · '+open+' offen':'';
    $('round-sources').innerHTML=list.map((s,index)=>{const chosen=selectedFor(s.id),original=pool.find(i=>i.source_id===s.id&&i.kind==='original');return `<button type="button" data-source="${esc(s.id)}" aria-pressed="${s.id===active()?.source_id}" aria-label="Motiv ${index+1}: ${esc(s.caption)}"><img src="${esc(asset(chosen||original))}" alt="" loading="lazy"><span>${index+1} · ${esc(s.filename||s.caption)}</span><span class="round-source-status">${labels[R.sourceStatus(state,s.id,pool,policy)]}</span></button>`;}).join('');
    $('round-prev-source').disabled=list.length<2;$('round-next-source').disabled=list.length<2;
    const cal=calendarArt(),status=R.monthStatus(state,month,...args);
    $('round-finish-title').textContent=scope==='reserve'?'Zusatzvorrat gesichert':'3 · '+months[month-1]+' abschließen';
    $('round-finish-hint').textContent=scope==='reserve'?'Jede Wahl ist gespeichert. Die gewählten Motive bleiben für die freie Verteilung im Jahresplan verfügbar.':!cal?'Wähle zuerst das Kalenderbild für diesen Monat.':cal.place_slug!==city?'Das Kalenderbild zeigt '+cal.place+'. Für den Abschluss zu diesem Ort wechseln.':status==='done'?'Alle Motive geprüft. Kalenderbild und Instagram-Auswahl sind abgeschlossen.':open?open+' Motiv(e) noch offen: Instagram wählen oder bewusst überspringen.':status==='changed'?'Die Auswahl wurde seit dem Abschluss geändert. Bitte erneut abschließen.':'Alle Motive geprüft. Der Abschluss sichert eure Entscheidungen für die Planung.';
    $('round-complete').hidden=scope==='reserve';$('round-next-month').hidden=scope==='reserve';
    $('round-complete').disabled=disabled()||!cal||cal.place_slug!==city||open>0||status==='done';
    $('round-complete').textContent=status==='done'?'✓ Monat abgeschlossen':status==='changed'?'Änderungen abschließen':'Monat abschließen';
    $('round-next-month').textContent=month===12?'Zum Zusatzvorrat →':'Nächster Monat →';
  }
  function renderYear(){
    const plan=R.planning(state,...args),done=plan.months.filter(m=>m.status==='done').length;
    $('round-year-count').textContent=done+' / 12 Monate abgeschlossen · '+plan.total+' Beiträge ausgewählt';
    $('round-year-rows').innerHTML=plan.months.map(m=>`<tr><td><a href="?monat=${m.month}" data-year-month="${m.month}">${months[m.month-1]}</a><small>${esc(m.place||'Kalenderort noch offen')}</small></td><td><span class="round-${m.status}">${states[m.status]}</span></td><td>${m.theme.length}</td><td>${m.extras.length}</td><td>${m.posts.length} / 10</td><td class="round-missing">${m.missing?m.missing+' Beiträge':'Ziel erreicht'}</td></tr>`).join('');
    $('round-reserve-count').textContent=plan.reserve.length+' Beiträge im Zusatzvorrat · '+plan.unplanned.length+' davon noch unverplant. Insgesamt fehlen '+plan.months.reduce((n,m)=>n+m.missing,0)+' Beiträge bis zum Richtwert von 120. Neue Motive können jederzeit hinzukommen.';
    $('round-planned-posts').innerHTML=plan.months.filter(m=>m.posts.length).map(m=>`<section class="round-planned-month"><h3>${months[m.month-1]} · ${m.posts.length} Beiträge</h3><div class="round-planned-grid">${m.posts.map(row=>`<a href="${prefix}instagram/?ort=${encodeURIComponent(row.place_slug)}&foto=${encodeURIComponent(row.source_id)}#planung"><img src="${esc(asset(row))}" alt="${esc(row.title)}" loading="lazy"><span>${esc(row.place)} · ${row.origin==='reserve'?'Zusatzmotiv':'Ortsmotiv'}</span><span>${esc(row.artist||'Originalfoto')}</span></a>`).join('')}</div></section>`).join('')||'<p class="round-hint">Sobald ihr Motive auswählt, erscheinen sie hier.</p>';
    $('round-plan-export').disabled=blocked||busy;
  }
  function render(){
    ensureActive();renderSidebar();
    $('round-city').innerHTML='<option value="">Ort auswählen …</option>'+availableCities().map(([slug,name])=>{const art=assignedPlace(slug),m=art&&state.calendar.items[art.id].month;return `<option value="${esc(slug)}" ${slug===city?'selected':''}>${esc(name)}${m?' · '+months[m-1]:''}</option>`;}).join('');
    $('round-city').disabled=disabled();$('round-title').textContent=scope==='reserve'?'Freie Orte & Motive':months[month-1];
    $('round-step').textContent=scope==='reserve'?'Zusatzvorrat · über das Jahr verteilen':'Monatsrunde '+String(month).padStart(2,'0')+' / 12';
    const current=calendarArt();$('round-current-calendar').hidden=scope==='reserve'||!current;$('round-current-label').textContent=current?current.place+' · '+current.artist.name+' · '+(current.palette||current.source_caption):'';$('round-clear-calendar').disabled=disabled();
    $('round-tabs').hidden=scope==='reserve';document.querySelectorAll('[data-step]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.step===step)));
    $('round-instructions').textContent=scope==='reserve'?'Hier stehen Orte ohne Kalendermonat. Wähle je übrigem Motiv eine Instagram-Fassung; die Motive mischen wir später unter die Monatsorte.':step==='calendar'?'Vergleiche die Fassungen dieses Ortes. Links/Rechts blättert durch die Bilder. Erst „In den Kalender“ legt die Wahl fest.':'Gehe die Motive unten nacheinander durch. Pro Aufnahme eine Fassung für Instagram wählen, Format prüfen oder das Motiv bewusst überspringen.';
    renderArt();renderSources();renderYear();updateUrl();
  }
  async function commit(change){
    if(disabled())return false;
    busy=true;alert('');say('Wird gespeichert …');render();
    try{
      const next=R.validateBundle(change(clone(state)),...args);
      if(local){
        const response=await fetch('/api/auswahlrunde',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(next)});
        const result=await response.json();if(!response.ok){if(response.status===409)blocked=true;throw Error(result.error||'Speichern fehlgeschlagen.');}
        state=R.validateBundle(result,...args);
      }else{
        for(const part of Object.keys(keys))if(localStorage.getItem(keys[part])!==lastRaw[part]){blocked=true;throw Error('Die Auswahl wurde in einem anderen Fenster geändert. Bitte gespeicherten Stand neu laden.');}
        localStorage.setItem('toskana-2027-round-recovery-v1',JSON.stringify(state));
        const previous={...lastRaw};
        try{for(const part of Object.keys(keys)){next[part].revision=state[part].revision+1;localStorage.setItem(keys[part],JSON.stringify(next[part]));}}
        catch(e){for(const part of Object.keys(keys)){try{if(previous[part]===null)localStorage.removeItem(keys[part]);else localStorage.setItem(keys[part],previous[part]);}catch(_){}}throw Error('Browser-Speicher voll oder nicht verfügbar. Bitte Gesamtsicherung herunterladen.');}
        state=next;for(const part of Object.keys(keys))lastRaw[part]=localStorage.getItem(keys[part]);
      }
      say(local?'Im Projekt gesichert · '+new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}):'In diesem Browser gesichert · für die Übergabe Gesamtsicherung herunterladen');
      return true;
    }catch(e){alert(e.message);say('Nicht gespeichert · bisheriger Stand bleibt erhalten');return false;}
    finally{busy=false;render();}
  }
  function navigateVariant(delta){const list=candidates();if(!list.length)return;const index=list.findIndex(i=>i.id===activeId);activeId=list[(index+delta+list.length)%list.length].id;render();}
  function selectSource(id){const chosen=selectedFor(id),cal=catalog.find(i=>i.source_id===id&&state.calendar.items[i.id]?.month);activeId=chosen?.id||cal?.id||sourceVariants(id)[0]?.id||'';render();}
  function navigateSource(delta){const list=citySources();if(!list.length)return;const index=list.findIndex(s=>s.id===active()?.source_id);selectSource(list[(index+delta+list.length)%list.length].id);}
  function switchMonth(m){if(busy)return;scope='month';month=m;setContext();step=calendarArt()?'instagram':'calendar';render();}
  function reserve(){if(busy)return;scope='reserve';step='instagram';setContext();render();}
  async function chooseCalendar(){const item=active();if(!item||calendarError(item))return;if(await commit(b=>R.chooseCalendar(b,item.id,month,...args)))say('Kalenderbild gewählt und gesichert. Weiter mit „2 · Instagram-Motive“.');}
  async function toggleInstagram(){const item=active();if(!item||I.calendarSources(state.calendar,pool,policy).has(item.source_id))return;await commit(b=>{const selected=!b.instagram.items[item.id]?.selected;b.instagram=I.chooseItem(b.instagram,pool,item.id,{selected,...(selected?{month:null,final_frame:'full'}:{})},b.calendar,policy);b.workflow.skipped=b.workflow.skipped.filter(id=>id!==item.source_id);return b;});}
  function renderDialog(){const item=active();if(!item)return;$('round-dialog-title').textContent=item.place+' · '+item.artist+' · '+usage(item);$('round-dialog-art').src=asset(item);$('round-dialog-art').alt=item.title;$('round-dialog-choice').textContent=step==='calendar'&&scope==='month'?$('round-calendar').textContent:$('round-instagram').textContent;$('round-dialog-choice').disabled=step==='calendar'&&scope==='month'?$('round-calendar').disabled:$('round-instagram').disabled;}
  $('round-city').addEventListener('change',async e=>{city=e.target.value;activeId='';if(scope==='month'&&city)await commit(b=>{b.workflow.drafts[month]=city;return b;});else render();});
  $('round-months').addEventListener('click',e=>{const b=e.target.closest('[data-month]');if(b)switchMonth(Number(b.dataset.month));});
  $('round-reserve').addEventListener('click',reserve);
  $('round-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-step]');if(b){step=b.dataset.step;render();}});
  $('round-sources').addEventListener('click',e=>{const b=e.target.closest('[data-source]');if(b)selectSource(b.dataset.source);});
  $('round-variants').addEventListener('click',e=>{const b=e.target.closest('[data-variant]');if(b){activeId=b.dataset.variant;render();}});
  $('round-prev').addEventListener('click',()=>navigateVariant(-1));$('round-next').addEventListener('click',()=>navigateVariant(1));
  $('round-prev-source').addEventListener('click',()=>navigateSource(-1));$('round-next-source').addEventListener('click',()=>navigateSource(1));
  $('round-show-calendar').addEventListener('click',()=>{const current=calendarArt();if(current){city=current.place_slug;activeId=current.id;render();}});
  $('round-clear-calendar').addEventListener('click',()=>{const current=calendarArt();if(current)commit(b=>{b.calendar.items[current.id].month=null;return b;});});
  $('round-calendar').addEventListener('click',chooseCalendar);$('round-instagram').addEventListener('click',toggleInstagram);
  $('round-format').addEventListener('change',e=>{const id=activeId,format=e.target.value;commit(b=>{b.instagram.items[id]={...b.instagram.items[id],format,final_frame:'full'};return b;});});
  $('round-note').addEventListener('change',e=>{const id=activeId,note=e.target.value;commit(b=>{b.instagram.items[id]={...b.instagram.items[id],note};return b;});});
  $('round-skip').addEventListener('click',()=>{const id=active()?.source_id;if(!id)return;commit(b=>{b.workflow.skipped=b.workflow.skipped.includes(id)?b.workflow.skipped.filter(x=>x!==id):[...b.workflow.skipped,id];return b;});});
  $('round-complete').addEventListener('click',async()=>{if(await commit(b=>R.completeMonth(b,month,...args)))say(months[month-1]+' abgeschlossen · '+(local?'Gesamtsicherung im Projekt gespeichert.':'Im Browser gespeichert. Für die Übergabe Gesamtsicherung herunterladen.'));});
  $('round-next-month').addEventListener('click',()=>month===12?reserve():switchMonth(month+1));
  $('round-year-rows').addEventListener('click',e=>{const a=e.target.closest('[data-year-month]');if(a){e.preventDefault();switchMonth(Number(a.dataset.yearMonth));$('round-title').scrollIntoView({behavior:'smooth',block:'start'});}});
  $('round-enlarge').addEventListener('click',()=>{renderDialog();$('round-dialog').showModal();});
  $('round-dialog-close').addEventListener('click',()=>$('round-dialog').close());
  $('round-dialog-prev').addEventListener('click',()=>navigateVariant(-1));$('round-dialog-next').addEventListener('click',()=>navigateVariant(1));
  $('round-dialog-choice').addEventListener('click',()=>step==='calendar'&&scope==='month'?chooseCalendar():toggleInstagram());
  document.addEventListener('keydown',e=>{
    if(e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||e.target.closest('input,select,textarea,[contenteditable="true"]')||$('round-import-dialog').open)return;
    const actions={ArrowLeft:()=>navigateVariant(-1),ArrowRight:()=>navigateVariant(1),ArrowUp:()=>navigateSource(-1),ArrowDown:()=>navigateSource(1),' ':toggleInstagram,k:chooseCalendar};
    // Native buttons retain Space to avoid selecting an unrelated motive.
    if(e.key===' '&&e.target.closest('button,a')&&!$('round-dialog').open)return;
    if(actions[e.key]){e.preventDefault();actions[e.key]();}
  });
  $('round-export').addEventListener('click',()=>download('Toskana-2027-Gesamtsicherung-'+new Date().toISOString().slice(0,10)+'.json',invalid||state));
  $('round-plan-export').addEventListener('click',()=>download('Toskana-2027-Planungsgrundlage.json',{version:1,type:'toskana-planning-draft',year:2027,created_at:new Date().toISOString(),selection:state,plan:R.planning(state,...args),sources:sources.map(s=>({id:s.id,place:s.place,filename:s.filename,source_type:s.source_type||'photo'}))}));
  $('round-import').addEventListener('change',async e=>{
    const file=e.target.files[0];e.target.value='';if(!file||busy)return;
    try{if(file.size>2_000_000)throw Error('Die Sicherung ist zu groß.');imported=R.validateBundle(JSON.parse(await file.text()),...args);const plan=R.planning(imported,...args),count=plan.months.filter(m=>m.calendarId).length,done=plan.months.filter(m=>m.status==='done').length;$('round-import-summary').textContent=file.name+': '+count+' Kalenderbilder, '+plan.total+' Instagram-Beiträge, '+done+' abgeschlossene Monate. Aktuell: '+Object.values(state.calendar.items).filter(v=>v.month).length+' Kalenderbilder und '+Object.values(state.instagram.items).filter(v=>v.selected).length+' Instagram-Beiträge.';$('round-import-dialog').showModal();}
    catch(error){imported=null;alert(error.message);}
  });
  $('round-import-cancel').addEventListener('click',()=>{imported=null;$('round-import-dialog').close();});
  $('round-import-apply').addEventListener('click',async()=>{
    if(!imported||busy)return;if(blocked){alert('Bitte zuerst den gespeicherten Stand laden beziehungsweise bestehende Konflikte auflösen.');$('round-import-dialog').close();return;}
    const next=imported;imported=null;$('round-import-dialog').close();if(!local)download('Toskana-2027-vor-Import.json',state);
    if(await commit(b=>{for(const part of Object.keys(keys))next[part].revision=b[part].revision;return next;})){setContext();render();}
  });
  $('round-reload').addEventListener('click',()=>{if(!busy)location.reload();});
  window.addEventListener('storage',e=>{if(Object.values(keys).includes(e.key)&&e.newValue!==lastRaw[Object.keys(keys).find(p=>keys[p]===e.key)]){blocked=true;alert('In einem anderen Fenster wurde die Auswahl geändert. Bitte „Gespeicherten Stand laden“, bevor ihr weiterarbeitet.');render();}});
  window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue='';}});
  if(!blocked)say(local?'Jede Entscheidung wird direkt im Projekt gesichert.':'Bestehende Auswahl aus diesem Browser übernommen · Gesamtsicherung für die spätere Übergabe herunterladen');
  render();
})();
