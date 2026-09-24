/* Source-by-source decisions and exact, reversible 16:9 geometry. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./instagram-core.js'));else root.PhotoWorkshopCore=factory(root.InstagramCore);})(typeof globalThis!=='undefined'?globalThis:this,I=>{
  'use strict';
  const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
  const clone=x=>JSON.parse(JSON.stringify(x));
  function validateCrop(c){
    if(!object(c)||!['crop','contain'].includes(c.mode)||!['x','y'].every(k=>typeof c[k]==='number'&&Number.isFinite(c[k])&&c[k]>=0&&c[k]<=1))throw Error('Ungültiger 16:9-Bildrahmen.');
    return {x:c.x,y:c.y,mode:c.mode};
  }
  function validateExtras(w,pool){
    const crops=w.photo_crops??{},reviews=w.photo_reviews??{},byId=new Map(pool.map(i=>[i.id,i]));
    if(!object(crops)||!object(reviews))throw Error('Ungültige Entscheidungen der Fotowerkstatt.');
    const photo_crops={},photo_reviews={};
    for(const [id,c] of Object.entries(crops)){if(byId.get(id)?.kind!=='painting')throw Error('Unbekanntes Gemälde im Bildrahmen.');photo_crops[id]=validateCrop(c);}
    for(const [source,v] of Object.entries(reviews)){
      if(!object(v)||byId.get(v.image_id)?.kind!=='painting'||byId.get(v.image_id)?.source_id!==source||typeof v.at!=='string'||!Number.isFinite(Date.parse(v.at))||typeof v.signature!=='string'||v.signature.length>10000)throw Error('Ungültige Fotoentscheidung.');
      photo_reviews[source]={image_id:v.image_id,at:v.at,signature:v.signature};
    }
    return {photo_crops,photo_reviews};
  }
  function cropRect(width,height,crop){
    const c=validateCrop(crop);if(!(width>0&&height>0))throw Error('Bildmaße fehlen.');
    const w=Math.min(width,height*16/9),h=w*9/16;
    return {x:Math.max(0,width-w)*c.x,y:Math.max(0,height-h)*c.y,width:w,height:h};
  }
  function wallpaperGeometry(width,height,crop){
    const c=validateCrop(crop),rect=cropRect(width,height,c),base=c.mode==='contain'?Math.max(width,height*16/9):rect.width;
    const w=Math.max(16,Math.floor(base/16)*16),h=w*9/16;
    if(c.mode==='contain'){
      const scale=Math.min(w/width,h/height);
      return {width:w,height:h,draw:{x:(w-width*scale)/2,y:(h-height*scale)/2,width:width*scale,height:height*scale}};
    }
    const scale=w/rect.width;
    return {width:w,height:h,draw:{x:-rect.x*scale,y:-rect.y*scale,width:width*scale,height:height*scale}};
  }
  function signature(b,id,pool){
    const item=pool.find(i=>i.id===id),v=b.instagram.items[id]||{};
    const siblings=pool.filter(i=>i.source_id===item?.source_id&&b.instagram.items[i.id]?.selected).map(i=>i.id).sort();
    return JSON.stringify([id,siblings,!!v.selected,v.format||'original',v.final_frame||'full',v.note||'',b.workflow.wallpapers.includes(id),b.workflow.photo_crops?.[id]||null]);
  }
  function reviewed(b,source,pool){const r=b.workflow.photo_reviews?.[source];return !!r&&r.signature===signature(b,r.image_id,pool);}
  function downloadEligible(item,pool){const source=pool.find(i=>i.kind==='original'&&i.source_id===item?.source_id);return !!item&&item.width>=item.height&&(!source||source.width>=source.height);}
  function choose(raw,draft,pool,policy){
    const b=clone(raw),item=pool.find(i=>i.id===draft.id&&i.kind==='painting');
    if(!item)throw Error('Bitte eine generierte Malerfassung wählen.');
    if(draft.wallpaper&&!downloadEligible(item,pool))throw Error('Hochformate sind nur für Instagram vorgesehen, nicht für den 16:9-Download.');
    const previous=pool.filter(i=>i.source_id===item.source_id&&b.instagram.items[i.id]?.selected);
    b.instagram=I.chooseItem(b.instagram,pool,item.id,{selected:draft.instagram,format:draft.format,final_frame:draft.final_frame,note:draft.note},b.calendar,policy);
    if(!draft.instagram)for(const sibling of previous)b.instagram.items[sibling.id].selected=false;
    const oldChoice=b.workflow.photo_reviews?.[item.source_id]?.image_id;
    // Only replace the previous workshop download choice, retaining independent older picks.
    const wallpapers=new Set(b.workflow.wallpapers||[]);
    if(oldChoice&&oldChoice!==item.id)wallpapers.delete(oldChoice);
    if(draft.wallpaper)wallpapers.add(item.id);else wallpapers.delete(item.id);
    b.workflow.wallpapers=[...wallpapers].sort();
    b.workflow.photo_crops={...(b.workflow.photo_crops||{})};
    if(downloadEligible(item,pool))b.workflow.photo_crops[item.id]=validateCrop(draft.crop);
    else delete b.workflow.photo_crops[item.id];
    b.workflow.skipped=b.workflow.skipped.filter(id=>id!==item.source_id);
    if(!draft.instagram&&!I.calendarSources(b.calendar,pool,policy).has(item.source_id))b.workflow.skipped.push(item.source_id);
    b.workflow.photo_reviews={...(b.workflow.photo_reviews||{}),[item.source_id]:{image_id:item.id,at:new Date().toISOString(),signature:signature(b,item.id,pool)}};
    return b;
  }
  return {validateCrop,validateExtras,cropRect,wallpaperGeometry,signature,reviewed,choose,downloadEligible};
});
