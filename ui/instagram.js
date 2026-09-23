'use strict';
(() => {
  const $=id=>document.getElementById(id), core=window.InstagramCore;
  const read=id=>JSON.parse($(id).textContent);
  const pool=read('instagram-pool'), sources=read('instagram-sources'), policy=read('instagram-policy');
  const prefix=document.body.dataset.prefix, local=document.body.dataset.mode==='local';
  const storageKey='toskana-2027-instagram-v1', calendarKey='toskana-2027-selection-v1';
  const months=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  const byId=new Map(pool.map(item=>[item.id,item]));
  const bySource=new Map(sources.map(source=>[source.id,source]));
  const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const asset=path=>prefix+'assets/'+core.safeAsset(path);
  const label=item=>item.kind==='original'?'Originalfoto':item.artist;
  const defaultValue=()=>({selected:false,month:null,note:''});
  let state=core.emptySelection(), calendar=read('instagram-calendar'), occupied=new Map();
  let blocked='',invalidRaw=null,lastStored=null,storageUnavailable=false,calendarError='';
  let city='',filter='unused',activeSource='',queue=Promise.resolve(),pending=0,serverRevision=0;
  let saveTimer=null,exporting=false,refreshing=null,imported=null,invalidNotes=new Set(),unsavedConflicts=false;

  function message(text){$('ig-save-status').textContent=text;}
  function showStorageAlert(text,reason=''){
    if(reason)blocked=reason;
    $('ig-storage-message').textContent=text;$('ig-storage-alert').hidden=false;
    $('ig-raw-export').hidden=invalidRaw===null;
  }
  function value(id){return state.items[id]||defaultValue();}
  function conflictLabel(sourceId){return (occupied.get(sourceId)||[]).map(entry=>entry.kind==='cover'?'Titelseite':months[entry.month-1]).join(', ');}
  function checkCalendar(next){
    try {occupied=core.calendarSources(next,pool,policy);calendar=next;calendarError='';$('ig-calendar-alert').hidden=true;}
    catch(error){calendarError=error.message;$('ig-calendar-alert').textContent=error.message+' Kalenderbelegung kann gerade nicht geprüft werden. Bildexport erst nach einer gültigen Kalenderauswahl möglich.';$('ig-calendar-alert').hidden=false;}
  }
  try {state=core.validateSelection(read('instagram-state'),pool);serverRevision=state.revision;}
  catch(error){invalidRaw=$('instagram-state').textContent;showStorageAlert(error.message+' Der alte Stand bleibt erhalten. Sichere ihn und importiere eine gültige Planung.','invalid');}
  if(!local){
    try {
      lastStored=localStorage.getItem(storageKey);
      if(lastStored!==null){
        try {state=core.validateSelection(JSON.parse(lastStored),pool);}
        catch(error){invalidRaw=lastStored;showStorageAlert(error.message+' Der alte Browserstand bleibt erhalten. Sichere ihn und importiere eine gültige Planung.','invalid');}
      }
      const savedCalendar=localStorage.getItem(calendarKey);
      if(savedCalendar!==null){try {calendar=JSON.parse(savedCalendar);}catch(error){calendar=null;}}
    } catch(error){storageUnavailable=true;showStorageAlert('Browser-Speicher nicht verfügbar. Sichere deine Planung als JSON, bevor du die Seite verlässt.');calendar=null;}
  }
  checkCalendar(calendar);
  let persistedState=core.validateSelection(state,pool);
  const cities=[...new Map(sources.map(source=>[source.place_slug,source.place])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'de'));
  $('ig-city').innerHTML='<option value="">Alle Orte</option>'+cities.map(([slug,name])=>`<option value="${escape(slug)}">${escape(name)}</option>`).join('');
  const params=new URLSearchParams(location.search);
  if(cities.some(([slug])=>slug===params.get('ort')))city=params.get('ort');
  if(bySource.has(params.get('foto'))){activeSource=params.get('foto');city=bySource.get(activeSource).place_slug;if(occupied.has(activeSource))filter='all';}
  $('ig-city').value=city;
  $('ig-pool-count').textContent=sources.length+' Ausgangsfotos und '+pool.filter(item=>item.kind==='painting').length+' gemalte Fassungen.';

  function sourceVisible(source){
    if(city&&source.place_slug!==city)return false;
    if(filter==='unused')return calendarError||!occupied.has(source.id);
    if(filter==='selected')return pool.some(item=>item.source_id===source.id&&value(item.id).selected);
    return true;
  }
  function renderPhotos(){
    const visible=sources.filter(sourceVisible);
    if(!visible.some(source=>source.id===activeSource))activeSource=visible[0]?.id||'';
    document.querySelectorAll('[data-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.filter===filter)));
    $('ig-filter-hint').textContent=calendarError?'Kalenderbelegung unbekannt. Neue Vormerkungen sind bis zur Klärung gesperrt.':filter==='unused'?'Restmotive zeigen Fotos, die noch nicht im Kalender oder auf der Titelseite verwendet werden.':filter==='selected'?'Deine vorgemerkten Motive. Pro Motiv gehört eine Fassung in die Auswahl.':'Alle Ausgangsfotos. Motive aus dem Kalender sind für Instagram gesperrt.';
    $('ig-photos').innerHTML=visible.map(source=>{
      const variants=pool.filter(item=>item.source_id===source.id),count=variants.filter(item=>value(item.id).selected).length;
      const image=variants.find(item=>item.kind==='original');
      const sourceAsset=image?.asset||source.asset;
      return `<button type="button" class="ig-photo" data-source="${escape(source.id)}" aria-pressed="${source.id===activeSource}" aria-label="${escape(source.place+': '+source.caption)}"><img src="${escape(asset(sourceAsset))}" alt="" loading="lazy"><strong>${escape(source.place)}</strong><span>${variants.filter(item=>item.kind==='painting').length} Gemälde${count?' · '+count+' vorgemerkt':''}</span>${occupied.has(source.id)?'<span class="ig-photo-used">Kalender: '+escape(conflictLabel(source.id))+'</span>':''}</button>`;
    }).join('');
    $('ig-empty').hidden=visible.length>0;
    $('ig-empty').textContent=filter==='selected'?'Hier ist noch kein Foto vorgemerkt. Wechsle zu „Restmotive“ oder „Alle Fotos“.':'Für diesen Filter sind keine Fotos übrig. Wähle einen anderen Ort oder „Alle Fotos“.';
  }
  function renderVariants(){
    $('ig-variant-section').hidden=!activeSource;
    if(!activeSource)return;
    const source=bySource.get(activeSource),usage=conflictLabel(activeSource);
    $('ig-photo-title').textContent=source.place;
    $('ig-photo-caption').textContent=source.caption;
    $('ig-photo-usage').hidden=!usage;
    $('ig-photo-usage').textContent='Dieses Motiv ist im Kalender: '+usage+'. Für Instagram erst im Kalender abwählen. Das gilt für alle Maler und Farbvarianten dieser Aufnahme.';
    $('ig-atelier-link').href=prefix+'atelier/?ort='+encodeURIComponent(source.place_slug)+'&foto='+encodeURIComponent(source.id);
    const variants=pool.filter(item=>item.source_id===activeSource&&(item.kind==='painting'||$('ig-originals').checked));
    $('ig-variants').innerHTML=variants.map(item=>{
      const selected=value(item.id).selected;
      const story=item.story_url?prefix+'bilder/'+encodeURIComponent(item.id)+'/':'';
      const sibling=pool.find(other=>other.source_id===item.source_id&&other.id!==item.id&&value(other.id).selected);
      return `<article class="ig-variant ${selected?'is-selected':''}"><button type="button" class="ig-image-button" data-enlarge="${escape(item.id)}" aria-label="${escape(label(item)+' vollständig ansehen')}"><img src="${escape(asset(item.asset))}" alt="${escape(item.title+' — '+label(item))}" loading="lazy"></button><label class="ig-variant-label"><input type="checkbox" data-select="${escape(item.id)}" ${selected?'checked':''} ${blocked||(!selected&&(usage||calendarError))?'disabled':''}><span><strong>${escape(label(item))}</strong><span>${escape(item.palette||(item.kind==='original'?'Unser Reisefoto':item.title))}</span></span></label><label class="wallpaper-choice"><input type="checkbox" data-wallpaper-id="${escape(item.id)}"> Für Hintergrund &amp; Bildschirmschoner</label><p class="ig-variant-meta">${selected?'✓ Für Instagram gewählt':sibling?'Ersetzt '+escape(label(sibling)):'Für Instagram wählen'}${item.kind==='original'?'<br>'+escape(source.filename||'Ausgangsfoto'):'<br>Mit KI nach historischem Vorbild gemalt'}${story?'<br><a href="'+escape(story)+'">Zum Bild &amp; Vorbild</a>':''}</p>${usage?'<p class="ig-conflict">Kalendermotiv · vom Export ausgeschlossen</p>':''}</article>`;
    }).join('');
    const url=new URL(location.href);url.searchParams.set('ort',source.place_slug);url.searchParams.set('foto',source.id);history.replaceState(null,'',url);
  }
  function renderPlan(){
    if(invalidNotes.size)return;
    const selected=pool.filter(item=>value(item.id).selected);
    $('ig-selection-count').textContent=selected.length+' '+(selected.length===1?'Bild':'Bilder');
    const issues=core.selectionIssues(state,pool,occupied);
    $('ig-plan-count').textContent=(selected.length-issues.size)+' bereit · '+new Set(selected.map(i=>i.place_slug)).size+' Orte'+(issues.size?' · '+issues.size+' Konflikte':'');
    $('ig-plan-empty').hidden=selected.length>0;
    $('ig-plan-city').innerHTML='<option value="">Alle Orte</option>'+cities.map(([slug,name])=>`<option value="${escape(slug)}" ${$('ig-plan-city').value===slug?'selected':''}>${escape(name)}</option>`).join('');
    const visible=selected.filter(item=>(!$('ig-plan-city').value||item.place_slug===$('ig-plan-city').value)&&(!$('ig-plan-month').value||String(core.collectionMonth(item,value(item.id),calendar,pool)||0)===$('ig-plan-month').value));
    visible.sort((a,b)=>(core.collectionMonth(a,value(a.id),calendar,pool)||13)-(core.collectionMonth(b,value(b.id),calendar,pool)||13)||a.place.localeCompare(b.place,'de')||a.source_id.localeCompare(b.source_id));
    let previous='';
    $('ig-plan-list').innerHTML=visible.map(item=>{
      const v=value(item.id),usage=conflictLabel(item.source_id),folder=core.collectionFolder(item,core.collectionMonth(item,v,calendar,pool));
      const heading=previous===folder?'':`<h3 class="ig-group-title"><span>${folder.slice(0,2)}</span> ${escape(item.place)} <small>${core.collectionMonth(item,v,calendar,pool)?months[core.collectionMonth(item,v,calendar,pool)-1]:'Monat noch offen'} · 2027</small></h3>`;previous=folder;
      const format=v.format||'original',swipe=format.startsWith('swipe');
      const conflict=issues.get(item.id);
      return heading+`<article class="ig-plan-row ${conflict?'has-conflict':''}" data-plan="${escape(item.id)}"><button class="ig-plan-art" type="button" data-preview="${escape(item.id)}" data-slide="-1" aria-label="${escape(item.title+' vergrößern')}"><img src="${escape(asset(item.asset))}" alt="${escape(item.title)}" loading="lazy"></button><div class="ig-plan-info"><p class="ig-eyebrow">${item.kind==='painting'?'Gewählte Malerfassung':'Gewähltes Original'}</p><h3>${escape(label(item))}</h3><p>${escape(bySource.get(item.source_id)?.caption||item.title)}</p>${item.palette?'<p>'+escape(item.palette)+'</p>':''}<p class="ig-folder">${escape(folder)}</p>${conflict?'<p class="ig-conflict">'+(usage?'Im Kalender: '+escape(usage)+'. Hier abwählen oder im Kalender freigeben.':'Mehrere Fassungen dieses Motivs gewählt. Bitte genau eine behalten.')+' Bis dahin kein Export.</p>':''}${conflict==='duplicate-source'?'<button type="button" class="ig-quiet" data-keep="'+escape(item.id)+'">Diese Fassung behalten</button>':''}<a class="ig-text-link" href="#ig-browse" data-change="${escape(item.source_id)}">Maler wechseln</a><button type="button" class="ig-remove" data-remove="${escape(item.id)}" ${blocked?'disabled':''}>Abwählen</button></div><div class="ig-plan-settings"><label class="ig-field">Beitragsformat<select data-format="${escape(item.id)}" ${blocked?'disabled':''}>${Object.entries(core.formats).map(([id,name])=>`<option value="${id}" ${format===id?'selected':''} ${id.startsWith('swipe')&&!(item.width>item.height)?'disabled':''}>${escape(name)}${id==='swipe-'+core.recommendedSegments(item.width,item.height)?' · empfohlen':''}</option>`).join('')}</select></label>${swipe?`<label class="ig-field">Abschlussbild<select data-ending="${escape(item.id)}" ${blocked?'disabled':''}><option value="crop" ${v.final_frame==='crop'?'selected':''}>Zugeschnittener Ausschnitt · 4:5</option><option value="full" ${v.final_frame!=='crop'?'selected':''}>Ganzes Gemälde mit Rand · 4:5</option></select></label>`:''}<label class="ig-field ig-month-field">Planmonat<select data-month="${escape(item.id)}" ${blocked?'disabled':''}><option value="">Kalendermonat des Ortes / offen</option>${months.map((month,index)=>'<option value="'+(index+1)+'" '+(v.month===index+1?'selected':'')+'>'+month+'</option>').join('')}</select></label><label class="ig-field ig-note-field">Idee oder Notiz<textarea data-note="${escape(item.id)}" rows="2" ${blocked?'disabled':''}>${escape(v.note)}</textarea></label></div><div class="ig-slide-preview"><p>${swipe?'Ein Beitrag · '+(Number(format.slice(-1))+1)+' Seiten · von links nach rechts wischen':'Ein Einzelbild'}${format!=='original'?' · 1080 × 1350 px':''}</p><div class="ig-filmstrip">${previewSlides(item,v)}</div>${swipe?'<p class="ig-hint">Die ersten '+format.slice(-1)+' Seiten ergeben ein zusammenhängendes Panorama. Dafür wird das Bild auf 4:5-Seiten zugeschnitten. Die letzte Seite steht für sich.</p>':''}</div></article>`;
    }).join('')|| (selected.length?'<p class="ig-empty">Keine Auswahl für diesen Filter.</p>':'');
  }
  function previewSlides(item,v){
    if(!item.width||!item.height)return '';
    return core.slides(item.width,item.height,v.format||'original',v.final_frame||'full').map((slide,index)=>`<button type="button" class="ig-slide-button" data-preview="${escape(item.id)}" data-slide="${index}" aria-label="Seite ${index+1} vergrößern">${slideImage(item,slide)}<span>${index+1} · ${slide.kind==='panorama'?'Panorama':slide.kind==='crop'?'Ausschnitt':slide.kind==='full'?'Gesamtbild':'Original'}</span></button>`).join('');
  }
  function slideImage(item,slide){
    const d=slide.draw;
    return `<span class="ig-slide" style="aspect-ratio:${slide.width}/${slide.height}"><img src="${escape(asset(item.asset))}" alt="" loading="lazy" style="left:${d.x/slide.width*100}%;top:${d.y/slide.height*100}%;width:${d.width/slide.width*100}%;height:${d.height/slide.height*100}%"></span>`;
  }
  function currentExport(){return core.exportPlan(state,pool,calendar,policy);}
  function renderExport(){
    let plan=null;
    if(!calendarError)try {plan=currentExport();}catch(error){$('ig-export-status').textContent=error.message;}
    $('ig-zip').disabled=exporting||!plan?.rows.length||invalidNotes.size>0;
    $('ig-csv').disabled=exporting||!plan?.rows.length||invalidNotes.size>0;
    $('ig-export-summary').textContent=plan?plan.rows.length+' Motive · '+plan.rows.reduce((n,row)=>n+row.files.length,0)+' Bilddateien im Paket'+(plan.excluded.length?' · '+plan.excluded.length+' Konflikte werden ausgelassen.':'.'):'Export wartet auf eine gültige Kalenderauswahl.';
  }
  function render(){renderPhotos();renderVariants();renderPlan();renderExport();}

  function persist(){
    clearTimeout(saveTimer);saveTimer=null;
    if(blocked||invalidNotes.size)return;
    let snapshot;
    try {snapshot=core.validateSelection(state,pool);}catch(error){message(error.message);return;}
    const beforeIssues=core.selectionIssues(persistedState,pool,occupied);
    unsavedConflicts=[...core.selectionIssues(state,pool,occupied)].some(([id,reason])=>beforeIssues.get(id)!==reason);
    if(unsavedConflicts){message('Bitte die markierten Konflikte auflösen. Bis dahin bleibt dieser Entwurf ungespeichert; du kannst ihn als JSON sichern.');return;}
    if(!local){
      if(storageUnavailable){message('Nur für diese Sitzung vorgemerkt. Bitte die Planung als JSON sichern.');return;}
      try {
        if(localStorage.getItem(storageKey)!==lastStored){showStorageAlert('Die Planung wurde in einem anderen Fenster geändert. Sichere bei Bedarf deinen Entwurf als JSON und lade die Seite neu.','conflict');render();return;}
        state.revision++;lastStored=JSON.stringify(state);localStorage.setItem(storageKey,lastStored);persistedState=core.validateSelection(state,pool);message('In diesem Browser gespeichert.');
      } catch(error){storageUnavailable=true;showStorageAlert('Browser-Speicher nicht verfügbar. Bitte die Planung als JSON sichern.');message('Die letzte Änderung ist nur für diese Sitzung vorgemerkt.');}
      return;
    }
    pending++;message('Wird im Projekt gespeichert …');
    queue=queue.then(async()=>{
      if(blocked)return;
      snapshot.revision=serverRevision;
      const response=await fetch(prefix+'api/instagram/auswahl',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(snapshot)});
      const data=await response.json();
      if(!response.ok)throw Error(data.error||'Speichern fehlgeschlagen.');
      const saved=core.validateSelection(data,pool);serverRevision=saved.revision;state.revision=saved.revision;persistedState=saved;
      message('Im Projekt gespeichert.');
    }).catch(error=>{showStorageAlert(error.message+' Sichere deinen Entwurf als JSON und lade die Seite neu.','conflict');render();message('Die letzte Änderung konnte nicht gespeichert werden.');}).finally(()=>{pending--;});
  }
  function changeItem(id,patch){
    if(blocked)return;
    if(invalidNotes.size){message('Bitte zuerst die zu langen Notizen kürzen.');renderVariants();return;}
    try {
      if(!local){const saved=localStorage.getItem(calendarKey);checkCalendar(saved?JSON.parse(saved):calendar);}
      if(patch.selected&&calendarError)throw Error('Bitte zuerst die Kalenderbelegung prüfen.');
      state=core.chooseItem(state,pool,id,patch,calendar,policy);render();persist();
    }catch(error){message(error.message);renderVariants();}
  }
  function download(content,name,type){
    const url=URL.createObjectURL(new Blob([content],{type})),link=document.createElement('a');
    link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  const json=value=>JSON.stringify(value,null,2)+'\n';

  $('ig-city').addEventListener('change',event=>{city=event.target.value;renderPhotos();renderVariants();});
  document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.filter;renderPhotos();renderVariants();}));
  $('ig-originals').addEventListener('change',renderVariants);
  $('ig-photos').addEventListener('click',event=>{
    const button=event.target.closest('[data-source]');if(!button)return;
    activeSource=button.dataset.source;renderPhotos();renderVariants();
    $('ig-photos').querySelector('[data-source="'+CSS.escape(activeSource)+'"]')?.focus({preventScroll:true});
  });
  $('ig-variants').addEventListener('change',event=>{
    const input=event.target.closest('[data-select]');if(!input)return;
    changeItem(input.dataset.select,{selected:input.checked});
    $('ig-variants').querySelector('[data-select="'+CSS.escape(input.dataset.select)+'"]')?.focus({preventScroll:true});
  });
  $('ig-variants').addEventListener('click',event=>{
    const button=event.target.closest('[data-enlarge]');if(!button)return;
    const item=byId.get(button.dataset.enlarge),dialog=$('lightbox');
    dialog.querySelector('img').src=asset(item.asset);dialog.querySelector('img').alt=item.title+' — '+label(item);dialog.querySelector('p').textContent=item.place+' · '+label(item)+' · Vollständiges Bild, unbeschnitten';dialog.showModal();
  });
  $('ig-plan-list').addEventListener('click',event=>{
    const keep=event.target.closest('[data-keep]');if(keep){changeItem(keep.dataset.keep,{selected:true});return;}
    const change=event.target.closest('[data-change]');if(change){activeSource=change.dataset.change;city=bySource.get(activeSource).place_slug;filter='all';$('ig-city').value=city;renderPhotos();renderVariants();return;}
    const preview=event.target.closest('[data-preview]');if(preview){
      const item=byId.get(preview.dataset.preview),index=Number(preview.dataset.slide),v=value(item.id);
      const slide=core.slides(item.width,item.height,index<0?'original':v.format||'original',v.final_frame||'full')[Math.max(0,index)];
      $('ig-preview-image').innerHTML=slideImage(item,slide);$('ig-preview-caption').textContent=item.place+' · '+label(item)+(index<0?' · Original': ' · Seite '+(index+1));$('ig-preview-dialog').showModal();return;
    }
    const button=event.target.closest('[data-remove]');if(button){invalidNotes.delete(button.dataset.remove);changeItem(button.dataset.remove,{selected:false});}
  });
  $('ig-plan-list').addEventListener('change',event=>{
    if(event.target.matches('[data-month]'))changeItem(event.target.dataset.month,{month:event.target.value?Number(event.target.value):null});
    if(event.target.matches('[data-format]')){const id=event.target.dataset.format;changeItem(id,{format:event.target.value});$('ig-plan-list').querySelector('[data-format="'+CSS.escape(id)+'"]')?.focus({preventScroll:true});}
    if(event.target.matches('[data-ending]')){const id=event.target.dataset.ending;changeItem(id,{final_frame:event.target.value});$('ig-plan-list').querySelector('[data-ending="'+CSS.escape(id)+'"]')?.focus({preventScroll:true});}
  });
  $('ig-plan-city').addEventListener('change',renderPlan);$('ig-plan-month').addEventListener('change',renderPlan);
  $('ig-preview-close').addEventListener('click',()=>$('ig-preview-dialog').close());
  $('ig-plan-list').addEventListener('input',event=>{
    const input=event.target;if(!input.matches('[data-note]'))return;
    const id=input.dataset.note,valid=Array.from(input.value).length<=2000;
    input.setCustomValidity(valid?'':'Bitte höchstens 2000 Zeichen verwenden.');
    if(!valid){invalidNotes.add(id);message('Die Notiz ist zu lang. Bitte auf höchstens 2000 Zeichen kürzen.');renderExport();return;}
    invalidNotes.delete(id);state.items[id]={...value(id),note:input.value};renderExport();
    clearTimeout(saveTimer);saveTimer=setTimeout(persist,450);
  });
  $('ig-json-export').addEventListener('click',()=>{
    if(invalidNotes.size){message('Bitte die zu langen Notizen kürzen, bevor du exportierst.');return;}
    if(saveTimer)persist();
    download(json(state),'Toskana-2027-Instagram-Auswahl.json','application/json');
  });
  $('ig-raw-export').addEventListener('click',()=>download(invalidRaw,'Toskana-2027-Instagram-Alter-Speicherstand.json','application/json'));
  $('ig-reload').addEventListener('click',()=>location.reload());
  $('ig-json-import').addEventListener('click',()=>{
    if(blocked==='conflict'){$('ig-import-status').textContent='Bitte zuerst neu laden, damit der aktuelle Speicherstand berücksichtigt wird.';return;}
    $('ig-import-file').click();
  });
  $('ig-import-file').addEventListener('change',async event=>{
    const file=event.target.files[0];event.target.value='';if(!file)return;
    try {
      if(file.size>2*1024*1024)throw Error('Die JSON-Datei ist zu groß. Bitte eine exportierte Instagram-Planung wählen.');
      imported=core.validateSelection(JSON.parse(await file.text()),pool);
      const count=Object.values(imported.items).filter(item=>item.selected).length;
      $('ig-import-preview').textContent=file.name+': '+count+' vorgemerkte Bilder, '+Object.values(imported.items).filter(item=>item.note).length+' Notizen.';
      $('ig-import-dialog').showModal();$('ig-import-status').textContent='';
    }catch(error){imported=null;$('ig-import-status').textContent='Import nicht übernommen: '+error.message;}
  });
  $('ig-import-cancel').addEventListener('click',()=>{$('ig-import-dialog').close();imported=null;});
  $('ig-import-apply').addEventListener('click',()=>{
    if(!imported||blocked==='conflict')return;
    state={...imported,revision:state.revision};imported=null;invalidNotes.clear();blocked='';
    $('ig-import-dialog').close();$('ig-storage-alert').hidden=true;render();persist();
  });
  $('ig-csv').addEventListener('click',async()=>{
    if(exporting||calendarError||invalidNotes.size)return;
    exporting=true;renderExport();
    try {
      if(saveTimer)persist();
      if(local){await queue;await refreshLocal(true);}
      if(calendarError)throw Error('Die Kalenderauswahl konnte nicht geprüft werden.');
      const plan=currentExport();
      if(!plan.rows.length)throw Error('Für diesen Export sind keine Bilder ausgewählt.');
      download(core.planningCsv(plan.rows),'Toskana-2027-Instagram-Planung.csv','text/csv;charset=utf-8');
      $('ig-export-status').textContent='CSV-Planung für '+plan.rows.length+' Bilder bereitgestellt.';
    }catch(error){$('ig-export-status').textContent=error.message;}
    finally {exporting=false;renderExport();}
  });
  $('ig-zip').addEventListener('click',async()=>{
    if(exporting||calendarError||invalidNotes.size)return;
    exporting=true;renderExport();
    try {
      if(saveTimer)persist();
      if(local)await queue;
      if(local)await refreshLocal(true);
      if(calendarError)throw Error('Die Kalenderauswahl konnte nicht geprüft werden.');
      const plan=currentExport(),files=[];
      if(!plan.rows.length)throw Error('Für diesen Export sind keine Bilder ausgewählt.');
      for(const [index,row] of plan.rows.entries()){
        $('ig-export-status').textContent='Bild '+(index+1)+' von '+plan.rows.length+' wird geladen …';
        const url=new URL(asset(row.asset),location.href);
        if(url.origin!==location.origin)throw Error('Bilder müssen von dieser Website stammen.');
        const response=await fetch(url.href,{credentials:'same-origin',redirect:'error'});
        if(!response.ok)throw Error('Bild konnte nicht geladen werden: '+row.id);
        const bytes=new Uint8Array(await response.arrayBuffer());
        if(bytes[0]!==0xff||bytes[1]!==0xd8||bytes[2]!==0xff)throw Error('Keine gültige JPEG-Datei: '+row.id);
        files.push(...(row.format==='original'?[{name:row.filename,data:bytes}]:await window.InstagramMedia.renderFiles(row,bytes)));
      }
      // Recheck calendar changes that arrived while the JPEGs were loading.
      if(local)await refreshLocal(true);
      if(calendarError)throw Error('Die Kalenderauswahl hat sich geändert. Bitte den Export neu starten.');
      const latest=currentExport();
      if(JSON.stringify(latest.rows)!==JSON.stringify(plan.rows))throw Error('Die Planung oder Kalenderbelegung hat sich geändert. Bitte den Export neu starten.');
      const manifest={version:1,type:'instagram-export',year:2027,selection_revision:state.revision,calendar_source_ids:[...occupied.keys()],exported:plan.rows.map(row=>({...row,file:row.filename,publish_date:'',publish_time:''})),excluded:plan.excluded.map(row=>({id:row.id,source_id:row.source_id,reason:row.reason}))};
      files.push({name:'Auswahl.json',data:json(state)},{name:'Manifest.json',data:json(manifest)},{name:'Planung.csv',data:core.planningCsv(plan.rows)});
      download(core.createZip(files),'Toskana-2027-Instagram-Bildpaket.zip','application/zip');
      $('ig-export-status').textContent=plan.rows.length+' Motive mit '+plan.rows.reduce((n,row)=>n+row.files.length,0)+' Bilddateien im gewählten Format bereitgestellt.';
    }catch(error){$('ig-export-status').textContent=error.message+' Es wurde kein unvollständiges Bildpaket exportiert.';}
    finally {exporting=false;renderExport();}
  });

  function refreshLocal(force=false){
    if(refreshing)return refreshing;
    if((pending||saveTimer)&&force!==true)return Promise.resolve();
    refreshing=refreshLocalState().finally(()=>{refreshing=null;});
    return refreshing;
  }
  async function refreshLocalState(){
    const before=JSON.stringify([...occupied]),previousError=calendarError,previousBlocked=blocked,revisionAtStart=serverRevision;
    const results=await Promise.allSettled(['kalender','instagram'].map(async kind=>{
      const response=await fetch(prefix+'api/'+kind+'/auswahl',{cache:'no-store'}),data=await response.json();
      if(!response.ok)throw Error(data.error||'Auswahl konnte nicht geladen werden.');
      return data;
    }));
    if(results[0].status==='fulfilled')checkCalendar(results[0].value);
    else {calendarError='Kalenderauswahl konnte nicht aktualisiert werden.';$('ig-calendar-alert').hidden=false;$('ig-calendar-alert').textContent=calendarError+' Bitte die lokale Verbindung prüfen.';}
    if(results[1].status==='fulfilled'){
      try {
        const remote=core.validateSelection(results[1].value,pool);
        if(serverRevision===revisionAtStart&&remote.revision!==serverRevision&&!pending&&!saveTimer){showStorageAlert('Die Instagram-Planung wurde in einem anderen Fenster geändert. Sichere bei Bedarf deinen Entwurf als JSON und lade neu.','conflict');}
      }catch(error){showStorageAlert(error.message+' Bitte den lokalen Speicherstand prüfen.','conflict');}
    }
    if(before!==JSON.stringify([...occupied])||previousError!==calendarError||previousBlocked!==blocked){
      renderPhotos();renderVariants();
      // Preserve an in-progress note while refreshing external calendar occupancy.
      if(!document.activeElement?.matches('[data-note]'))renderPlan();
    }
    renderExport();
  }
  window.addEventListener('storage',event=>{
    if(local)return;
    if(event.key===storageKey||event.key===null){showStorageAlert('Die Instagram-Planung wurde in einem anderen Fenster geändert. Sichere bei Bedarf deinen Entwurf als JSON und lade neu.','conflict');render();}
    if(event.key===calendarKey||event.key===null){
      try {checkCalendar(event.key===null||event.newValue===null?read('instagram-calendar'):JSON.parse(event.newValue));}catch(error){checkCalendar(null);}
      render();message('Kalenderbelegung aus dem anderen Fenster aktualisiert. Vormerkungen bleiben erhalten.');
    }
  });
  window.addEventListener('beforeunload',event=>{if(pending||saveTimer||invalidNotes.size||storageUnavailable||unsavedConflicts){event.preventDefault();event.returnValue='';}});
  if(local){
    window.addEventListener('focus',refreshLocal);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshLocal();});
    setInterval(()=>{if(!document.hidden)refreshLocal();},15000);
  }
  render();
})();
