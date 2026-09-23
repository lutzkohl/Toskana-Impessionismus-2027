/* Shared, revision-checked collection for gallery, atelier and Instagram. */
(() => {
  const node=document.getElementById('wallpaper-state');if(!node)return;
  const W=window.WallpaperCore,pool=JSON.parse(document.getElementById('wallpaper-pool').textContent),local=document.body.dataset.mode==='local',key='toskana-2027-round-v1';
  let state=JSON.parse(node.textContent),raw=null,busy=false,blocked=false;
  function validate(w){if(!w||w.version!==1||!Number.isSafeInteger(w.revision)||w.revision<0||!Array.isArray(w.skipped)||!w.completed||!w.drafts)throw Error('Ungültiger Bearbeitungsstand. Bitte in der Monatsrunde prüfen.');return {...w,wallpapers:W.ids(w.wallpapers===undefined?[]:w.wallpapers,pool)};}
  function status(message){document.querySelectorAll('[data-wallpaper-status]').forEach(n=>n.textContent=message);}
  try{if(!local){raw=localStorage.getItem(key);if(raw!==null)state=JSON.parse(raw);}state=validate(state);}catch(e){blocked=true;status(e.message);}
  function sync(){document.querySelectorAll('[data-wallpaper-id]').forEach(n=>{n.checked=(state.wallpapers||[]).includes(n.dataset.wallpaperId);n.disabled=busy||blocked||!pool.some(i=>i.id===n.dataset.wallpaperId);});document.querySelectorAll('[data-wallpaper-count]').forEach(n=>{const count=String((state.wallpapers||[]).length);if(n.textContent!==count)n.textContent=count;});}
  async function choose(id,selected){
    if(busy||blocked){sync();return;}busy=true;sync();
    try{
      const next=W.choose(state,id,selected,pool);
      if(local){const response=await fetch('/api/hintergruende/auswahl',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:next.wallpapers,revision:state.revision})});const result=await response.json();if(!response.ok)throw Error(result.error||'Speichern fehlgeschlagen.');state=validate(result);}
      else{if(localStorage.getItem(key)!==raw)throw Error('Die Sammlung wurde in einem anderen Fenster geändert. Bitte neu laden.');next.revision=state.revision+1;const value=JSON.stringify(next);localStorage.setItem(key,value);raw=value;state=next;}
      status('Hintergrund-Sammlung gespeichert · '+state.wallpapers.length+' Bilder.');document.dispatchEvent(new CustomEvent('wallpaper-change'));
    }catch(e){blocked=true;status(e.message+' Bitte neu laden.');}
    finally{busy=false;sync();}
  }
  document.addEventListener('change',e=>{if(e.target.matches('[data-wallpaper-id]'))choose(e.target.dataset.wallpaperId,e.target.checked);});
  window.addEventListener('storage',e=>{if(e.key===key||e.key===null){blocked=true;status('Die Auswahl wurde in einem anderen Fenster geändert. Bitte neu laden.');sync();}});
  new MutationObserver(sync).observe(document.body,{childList:true,subtree:true});
  async function assertFresh(){if(blocked||busy)throw Error('Die Auswahl ist gerade nicht exportierbar. Bitte neu laden.');if(local){const response=await fetch('/api/hintergruende/auswahl');if(!response.ok)throw Error('Speicherstand nicht lesbar.');const current=await response.json();if(current.revision!==state.revision)throw Error('Die Auswahl wurde geändert. Bitte neu laden.');}else if(localStorage.getItem(key)!==raw)throw Error('Die Auswahl wurde geändert. Bitte neu laden.');}
  window.WallpaperSelection={assertFresh,sync,choose,ids:()=>[...(state.wallpapers||[])],revision:()=>state.revision,valid:()=>!blocked&&!busy};sync();
})();
