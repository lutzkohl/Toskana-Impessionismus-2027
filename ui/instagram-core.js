/* Shared selection and export rules. No network, storage or DOM dependencies. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.InstagramCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
  const validMonth=value=>value===null||(Number.isInteger(value)&&value>=1&&value<=12);
  const imageFormat='Unbeschnittenes JPEG; Instagram-Zuschnitt später festlegen';
  const emptySelection=()=>({version:1,type:'instagram-selection',year:2027,revision:0,items:{}});

  function validateSelection(raw,pool){
    if(!object(raw)||raw.version!==1||raw.type!=='instagram-selection'||raw.year!==2027||!Number.isSafeInteger(raw.revision)||raw.revision<0||!object(raw.items))throw Error('Die Instagram-Auswahl hat ein unbekanntes Format.');
    const known=new Map(pool.map(item=>[item.id,item]));
    const clean={...emptySelection(),revision:raw.revision};
    for(const [id,value] of Object.entries(raw.items)){
      if(!known.has(id)||!object(value))throw Error('Die Auswahl enthält ein unbekanntes Bild: '+id);
      const month=value.month??null,note=value.note===undefined?'':value.note;
      if(typeof value.selected!=='boolean'||!validMonth(month)||typeof note!=='string'||Array.from(note).length>2000)throw Error('Ungültige Vormerkung für '+id+'. Monat: 1–12 oder offen. Notiz: höchstens 2000 Zeichen.');
      if(value.allow_calendar_variant!==undefined&&(typeof value.allow_calendar_variant!=='boolean'||(value.allow_calendar_variant&&known.get(id).kind!=='painting')))throw Error('Nur gemalte Alternativen können für ein Kalenderfoto freigegeben werden.');
      clean.items[id]={selected:value.selected,month,note};
      if(value.allow_calendar_variant!==undefined)clean.items[id].allow_calendar_variant=value.allow_calendar_variant;
    }
    return clean;
  }

  function calendarSources(state,pool,policy={}){
    if(!object(state)||state.version!==1||state.year!==2027||!Number.isSafeInteger(state.revision)||state.revision<0||!object(state.items))throw Error('Die Kalenderauswahl hat ein unbekanntes Format.');
    const known=new Map(pool.filter(item=>item.kind==='painting').map(item=>[item.id,item]));
    const occupied=new Map();
    function add(id,usage){
      const item=known.get(id);
      if(!item)throw Error('Unbekanntes Kalenderbild: '+id);
      const list=occupied.get(item.source_id)||[];
      list.push({id,...usage});occupied.set(item.source_id,list);
    }
    if(policy.cover_image_id)add(policy.cover_image_id,{kind:'cover',month:null});
    for(const [id,value] of Object.entries(state.items)){
      if(!known.has(id)||!object(value)||!validMonth(value.month??null))throw Error('Ungültiges Kalenderbild: '+id);
      if(value.month)add(id,{kind:'month',month:value.month});
    }
    return occupied;
  }

  function safeAsset(asset){
    if(typeof asset!=='string'||!asset.split('/').every(part=>/^[a-zA-Z0-9_-][a-zA-Z0-9._-]*$/.test(part))||!/\.jpe?g$/i.test(asset))throw Error('Ungültiger JPEG-Bildpfad.');
    return asset;
  }

  function collectionMonth(item,value,calendar,pool){
    if(value.month)return value.month;
    const assigned=pool.find(candidate=>candidate.kind==='painting'&&candidate.place_slug===item.place_slug&&calendar?.items?.[candidate.id]?.month);
    return assigned?calendar.items[assigned.id].month:null;
  }
  function collectionFolder(item,month){
    const place=(item.place||item.place_slug).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
    if(!place)throw Error('Der Ortsname für den Ordner fehlt.');
    return String(month||0).padStart(2,'0')+'_'+place;
  }
  function isCalendarBlocked(item,value,occupied){
    const uses=occupied.get(item.source_id)||[];
    return uses.length>0&&!(value?.allow_calendar_variant&&item.kind==='painting'&&!uses.some(entry=>entry.id===item.id));
  }

  function exportPlan(raw,pool,calendar,policy,includeCalendar=false){
    const state=validateSelection(raw,pool), occupied=calendarSources(calendar,pool,policy);
    const rows=[],excluded=[],selection=state;
    for(const item of pool){
      const value=state.items[item.id];
      if(!value?.selected)continue;
      if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(item.id))throw Error('Ungültige Bild-ID für den Export.');
      const collection_month=collectionMonth(item,value,calendar,pool),folder=collectionFolder(item,collection_month);
      const row={folder,collection_month,id:item.id,source_id:item.source_id,place:item.place,place_slug:item.place_slug,kind:item.kind,title:item.title,artist:item.artist,palette:item.palette,story_url:item.story_url||'',asset:safeAsset(item.asset),filename:folder+'/'+item.id+'.jpg',month:value.month,note:value.note,image_format:imageFormat,calendar:occupied.get(item.source_id)||[]};
      if(isCalendarBlocked(item,value,occupied)&&!includeCalendar)excluded.push(row);
      else rows.push(row);
    }
    return {rows,excluded,selection};
  }

  function planningCsv(rows){
    const escape=value=>{
      let text=String(value??'');
      if(/^[\s]*[=+@-]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;
      return '"'+text.replace(/"/g,'""')+'"';
    };
    const headers=['Bild-ID','Quelldatei-ID','Datei','Ordner','Sammlungsmonat','Ort','Bildart','Bildformat','Titel','Maler','Farbstimmung','Planmonat','Datum','Uhrzeit','Notiz','Begleitseite','Kalenderbelegung'];
    const cells=rows.map(row=>[row.id,row.source_id,row.filename,row.folder,row.collection_month,row.place,row.kind==='original'?'Originalfoto':'Gemälde',row.image_format,row.title,row.artist,row.palette,row.month,'','',row.note,row.story_url,row.calendar.map(entry=>entry.kind==='cover'?'Titelseite':'Monat '+entry.month).join(', ')]);
    return '\ufeff'+[headers,...cells].map(row=>row.map(escape).join(';')).join('\r\n')+'\r\n';
  }

  const crcTable=Uint32Array.from({length:256},(_,n)=>{
    for(let bit=0;bit<8;bit++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;
    return n>>>0;
  });
  function crc32(bytes){
    let crc=0xffffffff;
    for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);
    return (crc^0xffffffff)>>>0;
  }

  // ZIP method 0 preserves already-compressed JPEGs. UTF-8 filenames, central
  // directory and CRC32 follow the standard ZIP format; ZIP64 is unnecessary here.
  function createZip(entries){
    if(!Array.isArray(entries)||entries.length>65535)throw Error('Zu viele Dateien für dieses Bildpaket.');
    const encoder=new TextEncoder(),seen=new Set(),records=[];
    let fileSize=0,centralSize=0;
    for(const entry of entries){
      if(!entry||typeof entry.name!=='string'||/[\\\x00-\x1f:]/.test(entry.name)||entry.name.split('/').some(part=>!part||part==='.'||part==='..')||seen.has(entry.name))throw Error('Ungültiger oder doppelter Dateiname im Bildpaket.');
      seen.add(entry.name);
      const name=encoder.encode(entry.name);
      const data=typeof entry.data==='string'?encoder.encode(entry.data):entry.data;
      if(!(data instanceof Uint8Array)||name.length>65535||data.length>0xffffffff)throw Error('Ungültige oder zu große Datei im Bildpaket.');
      records.push({name,data,crc:crc32(data),offset:fileSize});
      fileSize+=30+name.length+data.length;centralSize+=46+name.length;
    }
    if(fileSize+centralSize+22>0xffffffff)throw Error('Das Bildpaket ist zu groß. Bitte weniger Bilder auswählen.');
    const zip=new Uint8Array(fileSize+centralSize+22),view=new DataView(zip.buffer);
    const u16=(at,value)=>view.setUint16(at,value,true),u32=(at,value)=>view.setUint32(at,value,true);
    let central=fileSize;
    for(const entry of records){
      const at=entry.offset;
      u32(at,0x04034b50);u16(at+4,20);u16(at+6,0x800);u16(at+12,0x21);
      u32(at+14,entry.crc);u32(at+18,entry.data.length);u32(at+22,entry.data.length);u16(at+26,entry.name.length);
      zip.set(entry.name,at+30);zip.set(entry.data,at+30+entry.name.length);
      u32(central,0x02014b50);u16(central+4,20);u16(central+6,20);u16(central+8,0x800);u16(central+14,0x21);
      u32(central+16,entry.crc);u32(central+20,entry.data.length);u32(central+24,entry.data.length);u16(central+28,entry.name.length);u32(central+42,at);
      zip.set(entry.name,central+46);central+=46+entry.name.length;
    }
    u32(central,0x06054b50);u16(central+8,records.length);u16(central+10,records.length);u32(central+12,centralSize);u32(central+16,fileSize);
    return zip;
  }
  return {emptySelection,validateSelection,calendarSources,safeAsset,collectionMonth,collectionFolder,isCalendarBlocked,exportPlan,planningCsv,createZip};
});
