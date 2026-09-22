'use strict';
(() => {
  const $=id=>document.getElementById(id), core=window.InstagramCore;
  const read=id=>JSON.parse($(id).textContent);
  const pool=read('atelier-instagram-pool'), policy=read('selection-policy');
  const sources=new Map(read('atelier-sources').map(source=>[source.id,source]));
  const sourceOrder=new Map([...sources.keys()].map((id,index)=>[id,index]));
  const prefix=document.body.dataset.prefix, local=document.body.dataset.mode==='local';
  const key='toskana-2027-instagram-v1';
  const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const asset=item=>prefix+'assets/'+core.safeAsset(item.asset);
  const json=value=>JSON.stringify(value,null,2)+'\n';
  let state=core.emptySelection(), ctx=null, lastStored=null, blocked='', queue=Promise.resolve(), exporting=false;
  let serverRevision=0,viewerId=null;
  const value=id=>state.items[id]||{selected:false,month:null,note:''};
  const status=text=>{$('aig-status').textContent=text;$('aig-view-status').textContent=text;};
  try {
    state=core.validateSelection(read('atelier-instagram-state'),pool);
    serverRevision=state.revision;
    if(!local){
      lastStored=localStorage.getItem(key);
      if(lastStored!==null)state=core.validateSelection(JSON.parse(lastStored),pool);
    }
  }catch(error){blocked='Die gespeicherte Instagram-Auswahl konnte nicht gelesen werden. Bitte in der Instagram-Planung prüfen. Sie bleibt unverändert.';}

  function contextItem(){return pool.find(item=>item.place_slug===ctx?.city);}
  function folder(){return core.collectionFolder(contextItem(),ctx.month);}
  function usedImages(){
    const occupied=core.calendarSources(ctx.calendar,pool,policy);
    return new Set([...occupied.values()].flat().map(entry=>entry.id).concat(ctx.draftId||[]));
  }
  function candidates(){
    const used=usedImages();
    return pool.filter(item=>item.kind==='painting'&&item.place_slug===ctx.city&&!used.has(item.id))
      .sort((a,b)=>(sourceOrder.get(a.source_id)??0)-(sourceOrder.get(b.source_id)??0));
  }
  function belongs(item){return value(item.id).selected&&core.collectionMonth(item,value(item.id),ctx.calendar,pool)===ctx.month;}
  function plan(){
    const scoped={...state,items:Object.fromEntries(pool.filter(item=>item.kind==='painting'&&item.place_slug===ctx.city&&belongs(item)).map(item=>[item.id,value(item.id)]))};
    const result=core.exportPlan(scoped,pool,ctx.calendar,policy);
    result.excluded.push(...result.rows.filter(row=>row.id===ctx.draftId));
    result.rows=result.rows.filter(row=>row.id!==ctx.draftId);
    return result;
  }
  function render(){
    $('atelier-instagram').hidden=!contextItem();
    if(!contextItem()){if($('aig-dialog').open)$('aig-dialog').close();return;}
    if(ctx.calendarBlocked)blocked='Die Kalenderauswahl muss zuerst geprüft werden. Bitte neu laden.';
    let items=[],exportPlan,occupied=new Map();
    try {items=candidates();exportPlan=plan();occupied=core.calendarSources(ctx.calendar,pool,policy);}catch(error){blocked='Die Kalenderbelegung konnte nicht geprüft werden. Bitte neu laden.';}
    const name=folder(),count=exportPlan?.rows.length||0;
    $('aig-folder').textContent=name;
    $('aig-count').textContent=count+' '+(count===1?'Bild':'Bilder')+' in dieser Sammlung'+(exportPlan?.excluded.length?' · '+exportPlan.excluded.length+' Kalenderbilder ausgespart':'');
    $('aig-summary').textContent='Übrige Gemälde auswählen · '+items.length+' Varianten';
    $('aig-plan-link').href=prefix+'instagram/?ort='+encodeURIComponent(ctx.city)+'#planung';
    $('aig-zip').textContent=name+' als ZIP laden';
    $('aig-zip').disabled=!!blocked||exporting||!count;
    $('aig-local').hidden=!local;$('aig-local').disabled=!!blocked||exporting||!count;
    $('aig-grid').innerHTML=items.map(item=>{
      const saved=value(item.id),needsRelease=saved.selected&&core.isCalendarBlocked(item,saved,occupied);
      const selected=belongs(item)&&!needsRelease;
      const previous=saved.selected&&!belongs(item)?core.collectionFolder(item,core.collectionMonth(item,saved,ctx.calendar,pool)):'';
      return `<article class="aig-card ${selected?'is-selected':''}"><button type="button" class="aig-image" data-ig-enlarge="${escape(item.id)}" aria-label="${escape(item.artist+' — '+item.title+' vergrößern')}"><img src="${escape(asset(item))}" alt="${escape(item.title+' — '+item.artist)}" loading="lazy"></button><div class="aig-card-copy"><p class="aig-source">${escape(sources.get(item.source_id)?.caption||item.title)}</p><strong>${escape(item.artist)}</strong><p>${escape(item.palette||item.title)}</p><label><input type="checkbox" data-ig-choose="${escape(item.id)}" ${selected?'checked':''} ${blocked||exporting?'disabled':''}><span>${previous?'Nach '+escape(name)+' verschieben':needsRelease?'Andere Fassung freigeben':'Für Instagram wählen'}</span></label>${previous?'<small>Bisher: '+escape(previous)+'</small>':''}${needsRelease?'<small>Bisher wegen des Kalenderfotos vom Export ausgenommen.</small>':''}</div></article>`;
    }).join('');
    $('aig-empty').hidden=items.length>0;
    $('aig-alert').hidden=!blocked;$('aig-alert').textContent=blocked;
    renderViewer(items,occupied);
  }
  function assertBrowserFresh(){
    if(!local&&localStorage.getItem(key)!==lastStored)throw Error('Die Instagram-Auswahl wurde in einem anderen Fenster geändert. Bitte neu laden.');
  }
  function persist(){
    const snapshot=core.validateSelection(state,pool);
    if(!local){
      assertBrowserFresh();state.revision++;
      const encoded=JSON.stringify(state);localStorage.setItem(key,encoded);lastStored=encoded;
      status('In diesem Browser vorgemerkt. Mit dem ZIP sicherst du die Bilddateien.');return;
    }
    status('Instagram-Auswahl wird gespeichert …');
    queue=queue.then(async()=>{
      if(blocked)return;
      snapshot.revision=serverRevision;
      const response=await fetch(prefix+'api/instagram/auswahl',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(snapshot)});
      const data=await response.json();
      if(!response.ok)throw Error(data.error||'Speichern fehlgeschlagen.');
      serverRevision=core.validateSelection(data,pool).revision;state.revision=serverRevision;
      status('Instagram-Auswahl im Projekt gespeichert.');
    }).catch(error=>{blocked=error.message+' Bitte neu laden.';render();});
  }
  function choose(id,selected){
    if(!id||blocked||exporting||!candidates().some(item=>item.id===id))return;
    try {
      assertBrowserFresh();
      state.items[id]={...value(id),selected,month:ctx.month,allow_calendar_variant:true};
      persist();
    }catch(error){blocked=error.message+' Die Änderung konnte nicht gespeichert werden.';}
    render();
  }
  $('aig-grid').addEventListener('change',event=>{
    const id=event.target.dataset.igChoose;
    choose(id,event.target.checked);
    $('aig-grid').querySelector('[data-ig-choose="'+id+'"]')?.focus({preventScroll:true});
  });
  $('aig-grid').addEventListener('click',event=>{
    const button=event.target.closest('[data-ig-enlarge]');if(!button)return;
    if(!candidates().some(item=>item.id===button.dataset.igEnlarge))return;
    viewerId=button.dataset.igEnlarge;
    renderViewer();$('aig-dialog').showModal();
  });
  function renderViewer(items=candidates(),occupied=core.calendarSources(ctx.calendar,pool,policy)){
    if(!viewerId)return;
    const index=items.findIndex(item=>item.id===viewerId),item=items[index];
    if(!item){$('aig-dialog').close();viewerId=null;return;}
    const saved=value(item.id),selected=belongs(item)&&!core.isCalendarBlocked(item,saved,occupied);
    $('aig-view-image').src=asset(item);$('aig-view-image').alt=item.title+' — '+item.artist;
    $('aig-view-title').textContent=item.artist;
    $('aig-view-caption').textContent=(sources.get(item.source_id)?.caption||item.title)+(item.palette?' · '+item.palette:'');
    $('aig-view-count').textContent='Bild '+(index+1)+' von '+items.length;
    $('aig-view-folder').textContent=folder();
    $('aig-view-prev').disabled=items.length<2;$('aig-view-next').disabled=items.length<2;
    const toggle=$('aig-view-toggle');
    toggle.setAttribute('aria-pressed',String(selected));toggle.disabled=!!blocked||exporting;
    toggle.textContent=selected?'✓ Ausgewählt · Abwählen':saved.selected&&!belongs(item)?'Nach '+folder()+' verschieben':saved.selected&&core.isCalendarBlocked(item,saved,occupied)?'Andere Fassung freigeben':'Für Instagram wählen';
    $('aig-view-status').textContent=blocked||$('aig-status').textContent;
  }
  function navigateViewer(step){
    if(!$('aig-dialog').open)return;
    const items=candidates(),index=items.findIndex(item=>item.id===viewerId);
    if(index<0||!items.length)return;
    viewerId=items[(index+step+items.length)%items.length].id;renderViewer(items);
  }
  function toggleViewer(){
    if(!$('aig-dialog').open||blocked||exporting)return;
    const item=candidates().find(item=>item.id===viewerId);if(!item)return;
    const selected=belongs(item)&&!core.isCalendarBlocked(item,value(item.id),core.calendarSources(ctx.calendar,pool,policy));
    choose(item.id,!selected);
  }
  $('aig-view-prev').addEventListener('click',()=>navigateViewer(-1));
  $('aig-view-next').addEventListener('click',()=>navigateViewer(1));
  $('aig-view-toggle').addEventListener('click',toggleViewer);
  $('aig-view-close').addEventListener('click',()=>$('aig-dialog').close());
  $('aig-dialog').addEventListener('click',event=>{if(event.target===$('aig-dialog'))$('aig-dialog').close();});
  $('aig-dialog').addEventListener('close',()=>{
    const last=viewerId;viewerId=null;
    ($('aig-grid').querySelector('[data-ig-enlarge="'+last+'"]')||$('aig-summary')).focus({preventScroll:true});
  });
  $('aig-dialog').addEventListener('keydown',event=>{
    if(!$('aig-dialog').open||event.ctrlKey||event.altKey||event.metaKey)return;
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
      event.preventDefault();navigateViewer(event.key==='ArrowLeft'?-1:1);
    }else if(event.key===' '||event.key==='Spacebar'){
      event.preventDefault();if(!event.repeat)toggleViewer();
    }
  });
  async function fresh(){
    await queue;
    if(blocked)throw Error(blocked);
    assertBrowserFresh();
    ctx.calendar=await ctx.getCalendar();
    if(local){
      const [saved,calendar]=await Promise.all(['instagram','kalender'].map(async kind=>{
        const response=await fetch(prefix+'api/'+kind+'/auswahl',{cache:'no-store'}),data=await response.json();
        if(!response.ok)throw Error(data.error||'Speicherstand konnte nicht geprüft werden.');return data;
      }));
      if(core.validateSelection(saved,pool).revision!==serverRevision||calendar.revision!==ctx.calendar.revision)throw Error('Die Auswahl wurde in einem anderen Fenster geändert. Bitte neu laden.');
      core.calendarSources(calendar,pool,policy);ctx.calendar=calendar;
    }
  }
  function download(content,name){
    const url=URL.createObjectURL(new Blob([content],{type:'application/zip'})),link=document.createElement('a');
    link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  async function collect(onDisk){
    if(blocked||exporting||!contextItem())return;
    exporting=true;render();
    const collectionKey=()=>JSON.stringify([ctx.city,ctx.month,ctx.draftId]);
    const start=collectionKey();
    try {
      await fresh();
      if(start!==collectionKey())throw Error('Monat oder Ort wurde geändert. Bitte die Sammlung erneut starten.');
      const selected=plan(),name=folder();
      if(!selected.rows.length)throw Error('Bitte zuerst übrige Gemälde auswählen.');
      if(onDisk){
        const response=await fetch(prefix+'api/instagram/sammlung',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:serverRevision,calendar_revision:ctx.calendar.revision,place_slug:ctx.city,month:ctx.month,draft_id:ctx.draftId})});
        const data=await response.json();
        if(!response.ok)throw Error(data.error||'Sammlung fehlgeschlagen.');
        status(data.count+' '+(data.count===1?'Bild':'Bilder')+' gesammelt in '+data.path+'/'+data.folder+'/');
      }else {
        const files=[];
        for(const [index,row] of selected.rows.entries()){
          status('Lade Bild '+(index+1)+' von '+selected.rows.length+' für '+name+' …');
          const url=new URL(asset(row),location.href);
          if(url.origin!==location.origin)throw Error('Die Bilddatei muss von dieser Website stammen.');
          const response=await fetch(url.href,{credentials:'same-origin',redirect:'error'});
          if(!response.ok)throw Error('Das Bild konnte nicht geladen werden: '+row.id);
          const bytes=new Uint8Array(await response.arrayBuffer());
          if(bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)throw Error('Die Bilddatei ist kein gültiges JPEG: '+row.id);
          files.push({name:row.filename,data:bytes});
        }
        await fresh();
        if(start!==collectionKey()||JSON.stringify(plan())!==JSON.stringify(selected))throw Error('Die Auswahl wurde geändert. Bitte die Sammlung erneut starten.');
        const manifest={version:1,type:'instagram-export',year:2027,selection_revision:state.revision,
          calendar_source_ids:[...core.calendarSources(ctx.calendar,pool,policy).keys()],
          exported:selected.rows.map(row=>({...row,file:row.filename,publish_date:'',publish_time:''})),
          excluded:selected.excluded.map(row=>({id:row.id,source_id:row.source_id,reason:row.id===ctx.draftId||row.calendar.some(usage=>usage.id===row.id)?'calendar-image':'calendar-source'}))};
        files.push({name:'Auswahl.json',data:json(selected.selection)},{name:'Manifest.json',data:json(manifest)},{name:'Planung.csv',data:core.planningCsv(selected.rows)});
        download(core.createZip(files),'Instagram-'+name+'.zip');
        status(selected.rows.length+' '+(selected.rows.length===1?'Bild':'Bilder')+' bereitgestellt. ZIP entpacken: Darin liegt der Ordner '+name+'.');
      }
    }catch(error){status(error.message);}
    finally {exporting=false;render();}
  }
  $('aig-zip').addEventListener('click',()=>collect(false));
  $('aig-local').addEventListener('click',()=>collect(true));
  window.addEventListener('storage',event=>{
    if(!local&&(event.key===key||event.key===null)){
      blocked='Die Instagram-Auswahl wurde in einem anderen Fenster geändert. Bitte neu laden.';render();
    }
  });
  window.AtelierInstagram={update(next){
    const changed=ctx&&(ctx.city!==next.city||ctx.month!==next.month);
    ctx=next;if(changed&&!exporting)status('');render();
  }};
})();
