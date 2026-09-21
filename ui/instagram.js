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
  let saveTimer=null,exporting=false,refreshing=null,imported=null,invalidNotes=new Set();

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
    $('ig-filter-hint').textContent=calendarError?'Kalenderbelegung unbekannt: Bis zur Klärung werden alle Fotos angezeigt.':filter==='unused'?'Restmotive zeigen Fotos, die noch nicht im Kalender oder auf der Titelseite verwendet werden.':filter==='selected'?'Fotos mit mindestens einem vorgemerkten Bild. Kalenderüberschneidungen bleiben erhalten und werden markiert.':'Alle Ausgangsfotos. Kalenderbilder sind gekennzeichnet und können zusätzlich vorgemerkt werden.';
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
    $('ig-photo-usage').textContent='Dieses Quellenfoto ist im Kalender: '+usage+'. Vormerkungen bleiben bestehen. Andere im Atelier gewählte Gemälde dieses Fotos können exportiert werden.';
    $('ig-atelier-link').href=prefix+'atelier/?ort='+encodeURIComponent(source.place_slug)+'&foto='+encodeURIComponent(source.id);
    const variants=pool.filter(item=>item.source_id===activeSource&&(item.kind==='painting'||$('ig-originals').checked));
    $('ig-variants').innerHTML=variants.map(item=>{
      const selected=value(item.id).selected;
      const story=item.story_url?prefix+'bilder/'+encodeURIComponent(item.id)+'/':'';
      return `<article class="ig-variant ${selected?'is-selected':''}"><button type="button" class="ig-image-button" data-enlarge="${escape(item.id)}" aria-label="${escape(label(item)+' vollständig ansehen')}"><img src="${escape(asset(item.asset))}" alt="${escape(item.title+' — '+label(item))}" loading="lazy"></button><label class="ig-variant-label"><input type="checkbox" data-select="${escape(item.id)}" ${selected?'checked':''} ${blocked?'disabled':''}><span><strong>${escape(label(item))}</strong><span>${escape(item.palette||(item.kind==='original'?'Unser Reisefoto':item.title))}</span></span></label><p class="ig-variant-meta">${selected?'Für Instagram vorgemerkt':'Für Instagram vormerken'}${item.kind==='original'?'<br>'+escape(source.filename||'Ausgangsfoto'):'<br>Mit KI nach historischem Vorbild gemalt'}${story?'<br><a href="'+escape(story)+'">Zum Bild &amp; Vorbild</a>':''}</p>${usage?'<p class="ig-conflict">'+(core.isCalendarBlocked(item,value(item.id),occupied)?'Kalenderfoto · im Standardexport ausgelassen':'Andere Fassung des Kalenderfotos · zum Export freigegeben')+'</p>':''}</article>`;
    }).join('');
    const url=new URL(location.href);url.searchParams.set('ort',source.place_slug);url.searchParams.set('foto',source.id);history.replaceState(null,'',url);
  }
  function renderPlan(){
    if(invalidNotes.size)return;
    const selected=pool.filter(item=>value(item.id).selected);
    $('ig-selection-count').textContent=selected.length+' '+(selected.length===1?'Bild':'Bilder');
    $('ig-plan-count').textContent=selected.length+' vorgemerkt';$('ig-plan-empty').hidden=selected.length>0;
    $('ig-plan-list').innerHTML=selected.map(item=>{
      const itemValue=value(item.id),usage=conflictLabel(item.source_id);
      return `<article class="ig-plan-row" data-plan="${escape(item.id)}"><img src="${escape(asset(item.asset))}" alt="${escape(item.title)}" loading="lazy"><div class="ig-plan-info"><h3>${escape(item.place)}</h3><p>${escape(label(item))}</p>${item.palette?'<p>'+escape(item.palette)+'</p>':''}<p>Ordner: ${escape(core.collectionFolder(item,core.collectionMonth(item,itemValue,calendar,pool)))}</p>${usage?'<p class="ig-conflict">Kalender: '+escape(usage)+'<br>'+(core.isCalendarBlocked(item,itemValue,occupied)?'Im Standardexport ausgelassen':'Andere Fassung · zum Export freigegeben')+'</p>':''}<button type="button" class="ig-remove" data-remove="${escape(item.id)}" ${blocked?'disabled':''}>Vormerkung entfernen</button></div><label class="ig-field ig-note-field" for="note-${escape(item.id)}">Idee oder Notiz<textarea id="note-${escape(item.id)}" data-note="${escape(item.id)}" rows="3" ${blocked?'disabled':''}>${escape(itemValue.note)}</textarea></label><label class="ig-field ig-month-field" for="month-${escape(item.id)}">Planmonat (optional)<select id="month-${escape(item.id)}" data-month="${escape(item.id)}" ${blocked?'disabled':''}><option value="">Noch offen</option>${months.map((month,index)=>'<option value="'+(index+1)+'" '+(itemValue.month===index+1?'selected':'')+'>'+month+'</option>').join('')}</select></label></article>`;
    }).join('');
  }
  function currentExport(){return core.exportPlan(state,pool,calendar,policy,$('ig-include-calendar').checked);}
  function renderExport(){
    let plan=null;
    if(!calendarError)try {plan=currentExport();}catch(error){$('ig-export-status').textContent=error.message;}
    $('ig-zip').disabled=exporting||!plan?.rows.length||invalidNotes.size>0;
    $('ig-csv').disabled=exporting||!plan?.rows.length||invalidNotes.size>0;
    $('ig-export-summary').textContent=plan?plan.rows.length+' Bilder im Paket'+(plan.excluded.length?' · '+plan.excluded.length+' Kalenderbilder werden ausgelassen.':'.'):'Export wartet auf eine gültige Kalenderauswahl.';
  }
  function render(){renderPhotos();renderVariants();renderPlan();renderExport();}

  function persist(){
    clearTimeout(saveTimer);saveTimer=null;
    if(blocked||invalidNotes.size)return;
    let snapshot;
    try {snapshot=core.validateSelection(state,pool);}catch(error){message(error.message);return;}
    if(!local){
      if(storageUnavailable){message('Nur für diese Sitzung vorgemerkt. Bitte die Planung als JSON sichern.');return;}
      try {
        if(localStorage.getItem(storageKey)!==lastStored){showStorageAlert('Die Planung wurde in einem anderen Fenster geändert. Sichere bei Bedarf deinen Entwurf als JSON und lade die Seite neu.','conflict');render();return;}
        state.revision++;lastStored=JSON.stringify(state);localStorage.setItem(storageKey,lastStored);message('In diesem Browser gespeichert.');
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
      const saved=core.validateSelection(data,pool);serverRevision=saved.revision;state.revision=saved.revision;
      message('Im Projekt gespeichert.');
    }).catch(error=>{showStorageAlert(error.message+' Sichere deinen Entwurf als JSON und lade die Seite neu.','conflict');render();message('Die letzte Änderung konnte nicht gespeichert werden.');}).finally(()=>{pending--;});
  }
  function changeItem(id,patch){
    if(blocked)return;
    if(invalidNotes.size){message('Bitte zuerst die zu langen Notizen kürzen.');renderVariants();return;}
    state.items[id]={...value(id),...patch};render();persist();
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
    const button=event.target.closest('[data-remove]');if(button){invalidNotes.delete(button.dataset.remove);changeItem(button.dataset.remove,{selected:false});}
  });
  $('ig-plan-list').addEventListener('change',event=>{
    if(event.target.matches('[data-month]'))changeItem(event.target.dataset.month,{month:event.target.value?Number(event.target.value):null});
  });
  $('ig-plan-list').addEventListener('input',event=>{
    const input=event.target;if(!input.matches('[data-note]'))return;
    const id=input.dataset.note,valid=Array.from(input.value).length<=2000;
    input.setCustomValidity(valid?'':'Bitte höchstens 2000 Zeichen verwenden.');
    if(!valid){invalidNotes.add(id);message('Die Notiz ist zu lang. Bitte auf höchstens 2000 Zeichen kürzen.');renderExport();return;}
    invalidNotes.delete(id);state.items[id]={...value(id),note:input.value};renderExport();
    clearTimeout(saveTimer);saveTimer=setTimeout(persist,450);
  });
  $('ig-include-calendar').addEventListener('change',renderExport);
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
        files.push({name:row.filename,data:bytes});
      }
      // Recheck calendar changes that arrived while the JPEGs were loading.
      if(local)await refreshLocal(true);
      if(calendarError)throw Error('Die Kalenderauswahl hat sich geändert. Bitte den Export neu starten.');
      const latest=currentExport();
      if(JSON.stringify(latest.rows)!==JSON.stringify(plan.rows))throw Error('Die Planung oder Kalenderbelegung hat sich geändert. Bitte den Export neu starten.');
      const manifest={version:1,type:'instagram-export',year:2027,selection_revision:state.revision,calendar_source_ids:[...occupied.keys()],exported:plan.rows.map(row=>({...row,file:row.filename,publish_date:'',publish_time:''})),excluded:plan.excluded.map(row=>({id:row.id,source_id:row.source_id,reason:'calendar-source'}))};
      files.push({name:'Auswahl.json',data:json(state)},{name:'Manifest.json',data:json(manifest)},{name:'Planung.csv',data:core.planningCsv(plan.rows)});
      download(core.createZip(files),'Toskana-2027-Instagram-Bildpaket.zip','application/zip');
      $('ig-export-status').textContent=plan.rows.length+' unbeschnittene Bilder im ZIP bereitgestellt.';
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
  window.addEventListener('beforeunload',event=>{if(pending||saveTimer||invalidNotes.size||storageUnavailable){event.preventDefault();event.returnValue='';}});
  if(local){
    window.addEventListener('focus',refreshLocal);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshLocal();});
    setInterval(()=>{if(!document.hidden)refreshLocal();},15000);
  }
  render();
})();
