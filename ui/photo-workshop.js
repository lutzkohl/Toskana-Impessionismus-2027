/* The workshop saves to the existing calendar/Instagram/workflow bundle. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id),read=id=>JSON.parse($(id).textContent),clone=x=>JSON.parse(JSON.stringify(x));
  const I=window.InstagramCore,R=window.RoundCore,P=window.PhotoWorkshopCore;
  const catalog=read('pw-catalog'),sources=read('pw-sources'),pool=read('pw-pool'),policy=read('pw-policy'),suggestions=read('pw-suggestions');
  const args=[catalog,pool,sources,policy],byId=new Map(pool.map(i=>[i.id,i])),artById=new Map(catalog.map(i=>[i.id,i]));
  const prefix=document.body.dataset.prefix,local=document.body.dataset.mode==='local',keys={calendar:'toskana-2027-selection-v1',instagram:'toskana-2027-instagram-v1',workflow:'toskana-2027-round-v1'};
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const asset=i=>prefix+'assets/'+i.asset;
  const drafts=new Map(),variantCrops=new Map(),dirty=new Set(),lastRaw={};
  let state=read('pw-state'),blocked=false,busy=false,city='',filter='all',search='',current='',invalid=null;
  function alert(message){$('pw-alert').hidden=!message;$('pw-alert').textContent=message;}
  function download(name,value,type='application/json'){
    const blob=value instanceof Blob?value:new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)+'\n'],{type});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
  try{
    if(!local)for(const [part,key] of Object.entries(keys)){lastRaw[part]=localStorage.getItem(key);if(lastRaw[part]!==null)state[part]=JSON.parse(lastRaw[part]);}
    state=R.validateBundle(state,...args);
  }catch(e){invalid=local?state:{browser_data:lastRaw};blocked=true;state=R.validateBundle(read('pw-state'),...args);alert(e.message+' Es wird nichts überschrieben. Bitte den gespeicherten Stand in der Monatsrunde prüfen.');}
  const occupied=()=>I.calendarSources(state.calendar,pool,policy);
  const variants=source=>pool.filter(i=>i.source_id===source&&i.kind==='painting');
  const selected=source=>pool.find(i=>i.source_id===source&&state.instagram.items[i.id]?.selected);
  const calArt=source=>catalog.find(i=>i.source_id===source&&(state.calendar.items[i.id]?.month||i.id===policy.cover_image_id));
  function currentDraft(){
    if(drafts.has(current))return drafts.get(current);
    const list=variants(current),old=state.workflow.photo_reviews[current],ig=selected(current),calendar=calArt(current);
    const item=ig?.kind==='painting'?ig:calendar||byId.get(old?.image_id)||byId.get(suggestions.sources[current]?.image_id)||list[0];
    if(!item)return null;
    const v=state.instagram.items[item.id]||{},rec=suggestions.variants[item.id];
    const d={id:item.id,instagram:occupied().has(current)?false:ig?true:old?false:!state.workflow.skipped.includes(current),wallpaper:P.downloadEligible(item,pool)&&state.workflow.wallpapers.includes(item.id),format:v.format||rec.format,final_frame:v.final_frame||'full',note:v.note||'',crop:clone(state.workflow.photo_crops[item.id]||rec.crop)};
    drafts.set(current,d);return d;
  }
  function candidates(){return sources.filter(s=>(!city||s.place_slug===city)&&(!search||[s.id,s.filename,s.caption,s.place,s.photographer].join(' ').toLowerCase().includes(search))&&(filter==='all'||filter==='open'&&!P.reviewed(state,s.id,pool)||filter==='done'&&P.reviewed(state,s.id,pool)||filter==='instagram'&&!!selected(s.id)||filter==='calendar'&&occupied().has(s.id)||filter==='wallpaper'&&variants(s.id).some(i=>state.workflow.wallpapers.includes(i.id))));}
  function status(source){return dirty.has(source)?'Ungespeichert':P.reviewed(state,source,pool)?'✓ Geprüft':occupied().has(source)?'Kalender':selected(source)?'Instagram gewählt':'Noch offen';}
  function setDirty(){dirty.add(current);renderStatus();}
  function renderStatus(){
    const count=sources.filter(s=>P.reviewed(state,s.id,pool)).length;
    $('pw-progress').textContent=`${count} / ${sources.length} Aufnahmen geprüft`;
    $('pw-save-status').textContent=blocked?'Speichern gesperrt · bitte neu laden':busy?'Wird verarbeitet …':dirty.has(current)?'Änderungen noch nicht gespeichert':P.reviewed(state,current,pool)?'Entscheidung gespeichert':'Vorschlag · erst Speichern übernimmt die Entscheidung';
    for(const id of ['pw-save','pw-save-next'])$(id).disabled=blocked||busy||!current;
    $('pw-plan').disabled=blocked||busy||dirty.size>0;
    $('pw-zip').disabled=blocked||busy||dirty.size>0||!downloadRows().length;
    $('pw-backup').disabled=busy;
    $('pw-export-summary').textContent=`${Object.values(state.instagram.items).filter(v=>v.selected).length} Instagram-Motive · ${downloadRows().length} geprüfte 16:9-Downloads · ${dirty.size} ungespeicherte Entwürfe. Noch ungeprüfte Hintergrund-Vormerkungen bleiben in der Sammlung erhalten.`;
  }
  function renderSources(){
    const list=candidates();
    $('pw-source-list').innerHTML=list.map(s=>`<button type="button" class="pw-source" data-source="${esc(s.id)}" aria-current="${s.id===current}"><img src="${esc(prefix+'assets/'+s.asset)}" alt="" loading="lazy"><span><strong>${esc(s.place)}</strong><small>${esc(s.filename)}</small><small>${esc(status(s.id))}</small></span></button>`).join('');
    $('pw-empty').hidden=!!list.length;document.querySelector('.pw-desk').classList.toggle('pw-empty',!list.length);
  }
  function frameMarkup(item,g){const d=g.draw;return `<img src="${esc(asset(item))}" alt="${esc(item.title)}" style="left:${100*d.x/g.width}%;top:${100*d.y/g.height}%;width:${100*d.width/g.width}%;height:${100*d.height/g.height}%">`;}
  function slideMarkup(item,slide){return `<span class="pw-slide-window" style="aspect-ratio:${slide.width}/${slide.height}">${frameMarkup(item,slide)}</span>`;}
  function renderCrop(){
    const d=currentDraft(),item=byId.get(d.id),c=d.crop,r=P.cropRect(item.width,item.height,c),contain=c.mode==='contain';
    const stage=$('pw-crop-stage'),frame=$('pw-frame');
    stage.style.aspectRatio=contain?'16/9':`${item.width}/${item.height}`;
    stage.style.maxWidth=contain?'100%':`${Math.min(680,460*item.width/item.height)}px`;
    frame.style.left=contain?'0':`${100*r.x/item.width}%`;frame.style.top=contain?'0':`${100*r.y/item.height}%`;
    frame.style.width=contain?'100%':`${100*r.width/item.width}%`;frame.style.height=contain?'100%':`${100*r.height/item.height}%`;
    frame.style.cursor=contain?'default':'move';frame.setAttribute('aria-label',contain?'16:9-Rahmen mit vollständigem Gemälde':`16:9-Rahmen verschieben, horizontal ${Math.round(c.x*100)} Prozent, vertikal ${Math.round(c.y*100)} Prozent`);
    $('pw-crop-mode').value=c.mode;$('pw-crop-x').value=c.x*100;$('pw-crop-y').value=c.y*100;
    $('pw-crop-x').disabled=contain||item.width-r.width<1;$('pw-crop-y').disabled=contain||item.height-r.height<1;
    const g=P.wallpaperGeometry(item.width,item.height,c);$('pw-wallpaper-preview').innerHTML=frameMarkup(item,g);
    $('pw-resolution').textContent=`Download-Vorschau · ${g.width} × ${g.height} Pixel · ${contain?'vollständig mit Rand':'16:9-Ausschnitt'}`;
  }
  function renderPost(){
    const d=currentDraft(),item=byId.get(d.id),rec=suggestions.variants[item.id];
    const formats=Object.entries(I.formats).filter(([id])=>!id.startsWith('swipe')||item.width>item.height);
    $('pw-format').innerHTML=formats.map(([id,name])=>`<option value="${id}" ${id===d.format?'selected':''}>${esc(name)}${id===rec.format?' · empfohlen':''}</option>`).join('');
    $('pw-final').value=d.final_frame;$('pw-final-label').hidden=!d.format.startsWith('swipe');
    const slices=I.slides(item.width,item.height,d.format,d.final_frame);
    $('pw-slides').innerHTML=slices.map((s,n)=>`<button type="button" class="pw-slide" data-slide="${n}" aria-label="Posting-Seite ${n+1} vergrößern">${slideMarkup(item,s)}<span>${n+1} · ${s.kind==='full'?'Ganzes Gemälde':s.kind==='panorama'?'Panorama':s.kind==='crop'?'Ausschnitt':'Originalformat'}</span></button>`).join('');
    $('pw-post-reason').textContent=rec.format.startsWith('swipe')?`Empfehlung: ${rec.format.slice(-1)} zusammenhängende Panoramaseiten und zum Schluss das ganze Gemälde mit Rand. Die Vorschau zeigt den genauen Ausschnitt jeder Seite.`:rec.format==='framed'?'Empfehlung: Ein 4:5-Post mit dem vollständigen Gemälde und seitlichem Rand. Das Hochformat bleibt ganz.':'Empfehlung: Das vollständige Gemälde im Originalformat. So bleiben die Komposition und wichtige Bildteile erhalten.';
  }
  function render(){
    const list=candidates();if(!list.some(s=>s.id===current))current=list[0]?.id||'';
    renderSources();renderStatus();if(!current)return;
    const source=sources.find(s=>s.id===current),d=currentDraft(),item=byId.get(d.id),rec=suggestions.sources[current],blockedSource=occupied().has(current),isVideo=source.source_type==='video';
    $('pw-place').textContent=source.place;$('pw-filename').textContent=`${source.filename}${source.photographer?' · Foto: '+source.photographer:''} · ${variants(current).length} Malerfassungen · ${list.findIndex(s=>s.id===current)+1} / ${list.length}`;
    const cal=calArt(current);$('pw-usage').textContent=blockedSource?cal?.id===policy.cover_image_id?'Titelmotiv · Für Instagram ausgespart; als Hintergrund weiterhin nutzbar.':`Kalenderbild · Monat ${state.calendar.items[cal?.id]?.month||''} · Für Instagram ausgespart; als Hintergrund weiterhin nutzbar.`:selected(current)?`Bisher für Instagram: ${selected(current).artist||'Originalfoto'} · Eine andere Fassung ersetzt diese erst beim Speichern.`:'Freies Motiv · Für Instagram ist eine Malerfassung möglich.';
    $('pw-original').src=prefix+'assets/'+source.asset;$('pw-original').alt=source.caption||source.filename;$('pw-original-caption').textContent=isVideo?'Euer Videostandbild · Originalclip für spätere Reels':'Euer Ausgangsfoto';
    $('pw-recommendation').textContent=`Mein Vorschlag: ${byId.get(rec.image_id).artist}. ${rec.reason}`;
    $('pw-variants').innerHTML=variants(current).map(v=>`<button type="button" class="pw-variant" data-art="${esc(v.id)}" aria-pressed="${v.id===item.id}"><img src="${esc(asset(v))}" alt="${esc(v.artist+' · '+(v.palette||v.title))}" loading="lazy"><strong>${esc(v.artist)}</strong><small>${v.id===rec.image_id?'Empfohlen · ':''}${esc(v.palette||artById.get(v.id)?.reference.title||'')}${state.instagram.items[v.id]?.selected?' · Instagram gewählt':''}</small></button>`).join('');
    const downloadable=P.downloadEligible(item,pool);$('pw-crop-editor').hidden=!downloadable;document.querySelector('.pw-editors').classList.toggle('pw-instagram-only',!downloadable);if(!downloadable)d.wallpaper=false;
    $('pw-crop-art').src=asset(item);$('pw-crop-art').alt=item.title;$('pw-crop-reason').textContent=suggestions.variants[item.id].crop_reason;
    $('pw-wallpaper').checked=d.wallpaper;$('pw-instagram').checked=d.instagram;$('pw-instagram').disabled=blockedSource||blocked||busy;
    $('pw-instagram-hint').textContent=!downloadable?'Hochformat · Für Social Media, ohne 16:9-Rahmen oder Download.':blockedSource?'Dieses Ausgangsfoto gehört zum Kalender. Für Instagram bitte eine andere Aufnahme wählen.':'Ein Maler pro Ausgangsfoto. Der Maler darf bei anderen Instagram-Motiven wieder vorkommen.';
    $('pw-note').value=d.note;renderCrop();renderPost();renderStatus();
    const url=new URL(location.href);url.searchParams.set('foto',current);if(city)url.searchParams.set('ort',city);else url.searchParams.delete('ort');if(search)url.searchParams.set('suche',search);else url.searchParams.delete('suche');history.replaceState(null,'',url);
  }
  async function assertFresh(){
    if(blocked||busy)throw Error('Bitte den gespeicherten Stand neu laden.');
    if(local){const response=await fetch(prefix+'api/auswahlrunde');if(!response.ok)throw Error('Speicherstand nicht erreichbar.');const next=await response.json();if(Object.keys(keys).some(p=>next[p].revision!==state[p].revision))throw Error('Die Auswahl wurde in einem anderen Fenster geändert. Bitte neu laden.');}
    else for(const [part,key] of Object.entries(keys))if(localStorage.getItem(key)!==lastRaw[part])throw Error('Die Auswahl wurde in einem anderen Fenster geändert. Bitte neu laden.');
  }
  async function save(nextPhoto=false){
    if(blocked||busy||!current)return;
    const sourceId=current,list=candidates(),nextId=list[list.findIndex(s=>s.id===current)+1]?.id;
    try{
      await assertFresh();busy=true;renderStatus();alert('');
      const next=R.validateBundle(P.choose(state,currentDraft(),pool,policy),...args);
      if(local){
        const response=await fetch(prefix+'api/auswahlrunde',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(next)});const result=await response.json();
        if(!response.ok){if(response.status===409)blocked=true;throw Error(result.error||'Speichern fehlgeschlagen.');}state=R.validateBundle(result,...args);
      }else{
        for(const [part,key] of Object.entries(keys))if(localStorage.getItem(key)!==lastRaw[part]){blocked=true;throw Error('Anderes Fenster hat gespeichert. Bitte neu laden.');}
        localStorage.setItem('toskana-2027-round-recovery-v1',JSON.stringify(state));
        const before={...lastRaw};
        try{for(const [part,key] of Object.entries(keys)){next[part].revision=state[part].revision+1;localStorage.setItem(key,JSON.stringify(next[part]));}}
        catch(e){for(const [part,key] of Object.entries(keys)){try{if(before[part]===null)localStorage.removeItem(key);else localStorage.setItem(key,before[part]);}catch(_){}}throw Error('Speichern fehlgeschlagen. Bitte Gesamtsicherung herunterladen.');}
        state=next;for(const [part,key] of Object.entries(keys))lastRaw[part]=localStorage.getItem(key);
      }
      dirty.delete(sourceId);drafts.delete(sourceId);if(nextPhoto&&nextId)current=nextId;
    }catch(e){alert(e.message);}finally{busy=false;render();}
  }
  function navigate(delta){if(busy)return;const list=candidates(),n=list.findIndex(s=>s.id===current),next=list[n+delta];if(next){current=next.id;render();}}
  function downloadRows(){return pool.filter(i=>i.kind==='painting'&&P.downloadEligible(i,pool)&&state.workflow.wallpapers.includes(i.id)&&state.workflow.photo_crops[i.id]&&P.reviewed(state,i.source_id,pool)&&state.workflow.photo_reviews[i.source_id].image_id===i.id).map(i=>({...i,crop:state.workflow.photo_crops[i.id],geometry:P.wallpaperGeometry(i.width,i.height,state.workflow.photo_crops[i.id]),filename:'Toskana-2027-16zu9/'+i.id+'.jpg'}));}
  $('pw-city').innerHTML='<option value="">Alle Orte</option>'+[...new Map(sources.map(s=>[s.place_slug,s.place])).entries()].sort((a,b)=>a[1].localeCompare(b[1],'de')).map(([slug,name])=>`<option value="${esc(slug)}">${esc(name)}</option>`).join('');
  const params=new URLSearchParams(location.search);city=params.get('ort')||'';if(!sources.some(s=>s.place_slug===city))city='';current=params.get('foto')||'';$('pw-city').value=city;search=(params.get('suche')||'').toLowerCase().trim();$('pw-search').value=search;
  $('pw-city').addEventListener('change',e=>{city=e.target.value;render();});$('pw-filter').addEventListener('change',e=>{filter=e.target.value;render();});$('pw-search').addEventListener('input',e=>{search=e.target.value.toLowerCase().trim();render();});
  $('pw-source-list').addEventListener('click',e=>{const b=e.target.closest('[data-source]');if(b&&!busy){current=b.dataset.source;render();}});
  $('pw-variants').addEventListener('click',e=>{const b=e.target.closest('[data-art]');if(!b||busy)return;const d=currentDraft(),item=byId.get(b.dataset.art),rec=suggestions.variants[item.id],v=state.instagram.items[item.id];variantCrops.set(d.id,clone(d.crop));d.id=item.id;d.crop=clone(variantCrops.get(item.id)||state.workflow.photo_crops[item.id]||rec.crop);d.format=v?.format||rec.format;d.final_frame=v?.final_frame||'full';setDirty();render();});
  $('pw-prev').addEventListener('click',()=>navigate(-1));$('pw-next').addEventListener('click',()=>navigate(1));$('pw-save').addEventListener('click',()=>save());$('pw-save-next').addEventListener('click',()=>save(true));
  for(const [id,key] of [['pw-instagram','instagram'],['pw-wallpaper','wallpaper']])$(id).addEventListener('change',e=>{currentDraft()[key]=e.target.checked;setDirty();});
  $('pw-note').addEventListener('input',e=>{currentDraft().note=e.target.value;setDirty();});
  for(const [id,key] of [['pw-format','format'],['pw-final','final_frame']])$(id).addEventListener('change',e=>{currentDraft()[key]=e.target.value;setDirty();renderPost();});
  $('pw-reset-post').addEventListener('click',()=>{const d=currentDraft(),r=suggestions.variants[d.id];d.format=r.format;d.final_frame='full';setDirty();renderPost();});
  $('pw-crop-mode').addEventListener('change',e=>{currentDraft().crop.mode=e.target.value;setDirty();renderCrop();});
  for(const axis of ['x','y'])$('pw-crop-'+axis).addEventListener('input',e=>{currentDraft().crop[axis]=Number(e.target.value)/100;setDirty();renderCrop();});
  $('pw-reset-crop').addEventListener('click',()=>{const d=currentDraft();d.crop=clone(suggestions.variants[d.id].crop);setDirty();renderCrop();});
  let drag=null;const frame=$('pw-frame');
  frame.addEventListener('pointerdown',e=>{if(currentDraft().crop.mode!=='crop'||busy||blocked)return;const item=byId.get(currentDraft().id),r=P.cropRect(item.width,item.height,currentDraft().crop),rect=$('pw-crop-stage').getBoundingClientRect();drag={id:e.pointerId,x:e.clientX,y:e.clientY,initial:clone(currentDraft().crop),dx:rect.width*(1-r.width/item.width),dy:rect.height*(1-r.height/item.height)};frame.setPointerCapture(e.pointerId);e.preventDefault();frame.focus();});
  frame.addEventListener('pointermove',e=>{if(!drag)return;const c=currentDraft().crop;c.x=drag.dx>0?Math.max(0,Math.min(1,drag.initial.x+(e.clientX-drag.x)/drag.dx)):c.x;c.y=drag.dy>0?Math.max(0,Math.min(1,drag.initial.y+(e.clientY-drag.y)/drag.dy)):c.y;setDirty();renderCrop();});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])frame.addEventListener(event,()=>{drag=null;});
  frame.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)||currentDraft().crop.mode!=='crop')return;e.preventDefault();const c=currentDraft().crop,axis=['ArrowLeft','ArrowRight'].includes(e.key)?'x':'y',sign=['ArrowLeft','ArrowUp'].includes(e.key)?-1:1;c[axis]=Math.max(0,Math.min(1,c[axis]+sign*(e.shiftKey ? .1 : .01)));setDirty();renderCrop();});
  $('pw-slides').addEventListener('click',e=>{const b=e.target.closest('[data-slide]');if(!b)return;const d=currentDraft(),item=byId.get(d.id),n=Number(b.dataset.slide),slide=I.slides(item.width,item.height,d.format,d.final_frame)[n];$('pw-slide-large').innerHTML=slideMarkup(item,slide);$('pw-slide-label').textContent=`${item.artist} · Seite ${n+1}`;$('pw-slide-dialog').showModal();});$('pw-slide-close').addEventListener('click',()=>$('pw-slide-dialog').close());
  $('pw-backup').addEventListener('click',()=>{const name='Toskana-2027-Gesamtsicherung-'+new Date().toISOString().slice(0,10)+'.json';if(invalid){download(name,invalid);return;}const bundle=clone(state);if(dirty.size)bundle.workshop_drafts=Object.fromEntries([...drafts].filter(([id])=>dirty.has(id)));download(name,bundle);$('pw-export-status').textContent=dirty.size?'Sicherung enthält gespeicherte Entscheidungen und zusätzlich die noch nicht bestätigten Entwürfe. Für die Planung bitte erst speichern.':'Gesamtsicherung mit Bildrahmen heruntergeladen.';});
  $('pw-plan').addEventListener('click',async()=>{try{await assertFresh();if(dirty.size)throw Error('Bitte zuerst die offenen Entwürfe speichern.');download('Toskana-2027-Planungsgrundlage.json',{version:1,type:'toskana-planning-draft',year:2027,created_at:new Date().toISOString(),selection:state,plan:R.planning(state,...args),wallpapers:downloadRows(),sources:sources.map(s=>({id:s.id,filename:s.filename,place:s.place,source_type:s.source_type||'photo'}))});$('pw-export-status').textContent='Planungsgrundlage mit Motiven, Posting-Formaten und exakten 16:9-Rahmen heruntergeladen.';}catch(e){alert(e.message);}});
  $('pw-zip').addEventListener('click',async()=>{
    try{await assertFresh();if(dirty.size)throw Error('Bitte zuerst die offenen Entwürfe speichern.');const rows=downloadRows();if(!rows.length)throw Error('Bitte zuerst einen Download-Rahmen prüfen und speichern.');busy=true;renderStatus();
      const files=[];
      for(const [n,row] of rows.entries()){
        $('pw-export-status').textContent=`16:9-Bild ${n+1} / ${rows.length} wird vorbereitet …`;
        const img=new Image();img.src=asset(row);await img.decode();if(img.naturalWidth!==row.width||img.naturalHeight!==row.height)throw Error('Bildmaße geändert. Bitte neu laden.');
        const g=row.geometry,canvas=document.createElement('canvas');canvas.width=g.width;canvas.height=g.height;const ctx=canvas.getContext('2d');ctx.fillStyle='#f7f5ef';ctx.fillRect(0,0,g.width,g.height);ctx.imageSmoothingQuality='high';ctx.drawImage(img,g.draw.x,g.draw.y,g.draw.width,g.draw.height);
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.95));if(!blob)throw Error('Ein Bild konnte nicht exportiert werden.');files.push({name:row.filename,data:new Uint8Array(await blob.arrayBuffer())});
      }
      // Detect another tab's edits before handing off a now-stale export.
      busy=false;await assertFresh();busy=true;
      const encoder=new TextEncoder();files.push({name:'Toskana-2027-16zu9/Manifest.json',data:encoder.encode(JSON.stringify({year:2027,revision:state.workflow.revision,images:rows},null,2))});
      files.push({name:'Toskana-2027-16zu9/Danke-und-Spenden.txt',data:encoder.encode($('download-donation-text').textContent.trim()+'\n')});
      download('Toskana-2027-16zu9.zip',new Blob([I.createZip(files)],{type:'application/zip'}));$('pw-export-status').textContent=`${rows.length} geprüfte 16:9-Bilder mit Manifest als ZIP heruntergeladen.`;
    }catch(e){alert(e.message);}finally{busy=false;renderStatus();}
  });
  $('pw-reload').addEventListener('click',()=>location.reload());
  window.addEventListener('storage',e=>{if(Object.values(keys).includes(e.key)||e.key===null){blocked=true;alert('Die Auswahl wurde in einem anderen Fenster geändert. Bitte offene Entwürfe sichern und den gespeicherten Stand neu laden.');renderStatus();}});
  window.addEventListener('beforeunload',e=>{if(dirty.size){e.preventDefault();e.returnValue='';}});
  render();
})();
