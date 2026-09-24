/* Independent screen collection: never changes calendar or Instagram assignments. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.WallpaperCore=factory();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  const clone=x=>JSON.parse(JSON.stringify(x));
  function ids(values,pool){const known=new Set(pool.map(i=>i.id));if(!Array.isArray(values)||values.some(id=>typeof id!=='string'||!known.has(id)))throw Error('Die Hintergrund-Auswahl enthält unbekannte Bilder. Bitte den gespeicherten Stand prüfen.');return [...new Set(values)].sort();}
  function choose(workflow,id,selected,pool){ids([id],pool);const w=clone(workflow),current=ids(w.wallpapers===undefined?[]:w.wallpapers,pool);w.wallpapers=ids(selected?[...current,id]:current.filter(x=>x!==id),pool);return w;}
  function preserveLegacy(bundle,current){const b=clone(bundle);if(b.workflow){if(!Object.hasOwn(b.workflow,'wallpapers'))b.workflow.wallpapers=clone(current.wallpapers||[]);for(const field of ['photo_crops','photo_reviews'])if(!Object.hasOwn(b.workflow,field))b.workflow[field]=clone(current[field]||{});}return b;}
  return {ids,choose,preserveLegacy};
});
