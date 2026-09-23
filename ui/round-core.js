/* Monthly selection rounds: pure rules shared by the UI and handoff exports. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./instagram-core.js'),require('./selection-rules.js'));
  else root.RoundCore=factory(root.InstagramCore,root.CalendarSelectionRules);
})(typeof globalThis!=='undefined'?globalThis:this,function(I,C){
  'use strict';
  const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
  const clone=x=>JSON.parse(JSON.stringify(x));
  const emptyWorkflow=()=>({version:1,revision:0,skipped:[],completed:{},drafts:{}});
  const defaultCalendar=()=>({month:null,layout:'leiste',favorite:false,stars:0,note:''});
  function validateBundle(raw,catalog,pool,sources,policy={}){
    if(!object(raw)||raw.version!==1||raw.type!=='toskana-workflow'||raw.year!==2027)throw Error('Bitte eine Gesamtsicherung der Monatsrunde 2027 wählen.');
    I.calendarSources(raw.calendar,pool,policy);
    const calendar=clone(raw.calendar),used=new Set();
    for(const [id,v] of Object.entries(calendar.items)){
      const normalized={...defaultCalendar(),...v};
      if(!['leiste','schwebend','seitenrand','lichtband'].includes(normalized.layout)||typeof normalized.favorite!=='boolean'||!Number.isInteger(normalized.stars)||normalized.stars<0||normalized.stars>5||typeof normalized.note!=='string'||Array.from(normalized.note).length>2000)throw Error('Ungültige Kalenderauswahl.');
      if(normalized.month&&used.has(normalized.month))throw Error('Pro Monat bitte nur ein Kalenderbild wählen.');
      if(normalized.month)used.add(normalized.month);
      calendar.items[id]=normalized;
    }
    C.assertUnique(calendar,catalog,policy.cover_image_id);
    const instagram=I.validateSelection(raw.instagram,pool);
    if(I.selectionIssues(instagram,pool,I.calendarSources(calendar,pool,policy)).size)throw Error('Ein Motiv darf nur im Kalender oder auf Instagram vorkommen; für Instagram genau eine Fassung. Konflikte bitte in der Instagram-Auswahl auflösen.');
    const w=raw.workflow,sourceIds=new Set(sources.map(s=>s.id)),cities=new Set(sources.map(s=>s.place_slug));
    if(!object(w)||w.version!==1||!Number.isSafeInteger(w.revision)||w.revision<0||!Array.isArray(w.skipped)||!object(w.completed)||!object(w.drafts))throw Error('Ungültiger Bearbeitungsstand.');
    if(w.skipped.some(id=>!sourceIds.has(id)))throw Error('Ein übersprungenes Motiv ist unbekannt.');
    const workflow={...emptyWorkflow(),revision:w.revision,skipped:[...new Set(w.skipped)].sort()};
    for(const [m,v] of Object.entries(w.completed)){
      if(!/^(?:[1-9]|1[0-2])$/.test(m)||!object(v)||typeof v.signature!=='string'||v.signature.length>100000||typeof v.at!=='string'||!Number.isFinite(Date.parse(v.at)))throw Error('Ungültiger Monatsabschluss.');
      workflow.completed[m]={signature:v.signature,at:v.at};
    }
    for(const [m,city] of Object.entries(w.drafts)){
      if(!/^(?:[1-9]|1[0-2])$/.test(m)||!cities.has(city))throw Error('Ungültiger Ortsentwurf.');
      workflow.drafts[m]=city;
    }
    return {version:1,type:'toskana-workflow',year:2027,calendar,instagram,workflow};
  }
  function calendarItem(b,month,catalog){return catalog.find(i=>b.calendar.items[i.id]?.month===month)||null;}
  function sourceStatus(b,id,pool,policy){
    if(I.calendarSources(b.calendar,pool,policy).has(id))return 'calendar';
    if(pool.some(i=>i.source_id===id&&b.instagram.items[i.id]?.selected))return 'instagram';
    return b.workflow.skipped.includes(id)?'skipped':'open';
  }
  function signature(b,month,catalog,pool,sources,policy){
    const art=calendarItem(b,month,catalog);if(!art)return '';
    const local=sources.filter(s=>s.place_slug===art.place_slug).sort((a,b)=>a.id.localeCompare(b.id));
    const ids=new Set(local.map(s=>s.id));
    const chosen=pool.filter(i=>b.instagram.items[i.id]?.selected&&ids.has(i.source_id)).sort((a,b)=>a.id.localeCompare(b.id)).map(i=>[i.id,b.instagram.items[i.id].month,b.instagram.items[i.id].format||'original',b.instagram.items[i.id].final_frame||'full',b.instagram.items[i.id].note]);
    return JSON.stringify([art.id,b.calendar.items[art.id].layout,local.map(s=>[s.id,sourceStatus(b,s.id,pool,policy)]),chosen]);
  }
  function monthStatus(b,month,catalog,pool,sources,policy){
    const completion=b.workflow.completed[month];
    return completion?(completion.signature===signature(b,month,catalog,pool,sources,policy)?'done':'changed'):'open';
  }
  function completeMonth(raw,month,catalog,pool,sources,policy={}){
    if(!Number.isInteger(month)||month<1||month>12)throw Error('Ungültiger Monat.');
    const b=validateBundle(raw,catalog,pool,sources,policy),art=calendarItem(b,month,catalog);
    if(!art)throw Error('Bitte zuerst das Kalenderbild wählen.');
    const undecided=sources.filter(s=>s.place_slug===art.place_slug&&sourceStatus(b,s.id,pool,policy)==='open');
    if(undecided.length)throw Error(undecided.length+' Motiv(e) noch offen. Bitte für Instagram wählen oder bewusst überspringen.');
    b.workflow.completed[month]={signature:signature(b,month,catalog,pool,sources,policy),at:new Date().toISOString()};
    return b;
  }
  function chooseCalendar(raw,id,month,catalog,pool,sources,policy={}){
    const b=validateBundle(raw,catalog,pool,sources,policy),art=catalog.find(x=>x.id===id);
    if(!art||!Number.isInteger(month)||month<1||month>12)throw Error('Bitte ein Kalenderbild und einen Monat wählen.');
    if(b.calendar.items[id]?.month&&b.calendar.items[id].month!==month)throw Error('Dieses Bild ist bereits in einem anderen Monat gewählt. Dort zuerst freigeben.');
    for(const [key,v] of Object.entries(b.calendar.items))if(v.month===month)b.calendar.items[key]={...v,month:null};
    b.calendar.items[id]={...defaultCalendar(),...b.calendar.items[id],month};
    I.assertCalendarChange(b.calendar,raw.calendar,b.instagram,pool,policy);
    b.workflow.drafts[month]=art.place_slug;
    return validateBundle(b,catalog,pool,sources,policy);
  }
  function hash(text){let n=2166136261;for(const c of text)n=Math.imul(n^c.charCodeAt(0),16777619)>>>0;return n;}
  function planning(raw,catalog,pool,sources,policy={}){
    const b=validateBundle(raw,catalog,pool,sources,policy);
    const placeMonths=new Map(catalog.filter(i=>b.calendar.items[i.id]?.month).map(i=>[i.place_slug,b.calendar.items[i.id].month]));
    const rows=I.exportPlan(b.instagram,pool,b.calendar,policy).rows.map(row=>{
      const collection_month=placeMonths.get(row.place_slug)||null,folder=I.collectionFolder(row,collection_month),files=I.outputFiles(row,folder,row);
      return {...row,collection_month,month:collection_month,folder,files,filename:files[0]};
    });
    const months=Array.from({length:12},(_,index)=>{const month=index+1,art=calendarItem(b,month,catalog);return {month,calendarId:art?.id||null,place:art?.place||null,status:monthStatus(b,month,catalog,pool,sources,policy),theme:rows.filter(r=>r.collection_month===month),extras:[],posts:[],missing:0};});
    const reserve=rows.filter(r=>!r.collection_month).sort((a,b)=>hash(a.id)-hash(b.id)||a.id.localeCompare(b.id));
    const unplanned=[];
    for(const row of reserve){
      const minimum=Math.min(...months.map(m=>m.theme.length+m.extras.length));
      if(minimum>=10){unplanned.push(row);continue;}
      const candidates=months.filter(m=>m.theme.length+m.extras.length===minimum),target=candidates[hash(row.id)%candidates.length];target.extras.push(row);
    }
    for(const m of months){
      // Evenly interleave reserves; each source occurs once in the entire draft.
      const all=[...m.theme.map((row,i)=>({row,rank:(i+0.5)/m.theme.length,kind:'place'})),...m.extras.map((row,i)=>({row,rank:(i+0.5)/m.extras.length,kind:'reserve'}))].sort((a,b)=>a.rank-b.rank||a.kind.localeCompare(b.kind));
      m.posts=all.map(({row,kind})=>({...row,planned_month:m.month,origin:kind}));m.missing=Math.max(0,10-m.posts.length);
    }
    return {target:10,months,reserve,unplanned,total:rows.length};
  }
  return {emptyWorkflow,validateBundle,calendarItem,sourceStatus,signature,monthStatus,completeMonth,chooseCalendar,planning};
});
