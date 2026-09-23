/* Keep calendar assignments exclusive with the Instagram shortlist. */
(() => {
  'use strict';
  const read=(a,b)=>JSON.parse((document.getElementById(a)||document.getElementById(b)).textContent);
  const core=window.InstagramCore,pool=read('atelier-instagram-pool','instagram-pool');
  const local=document.body.dataset.mode==='local',key='toskana-2027-instagram-v1';
  const policy=read('selection-policy');
  let state=read('atelier-instagram-state','instagram-state'),error='';
  function refreshBrowser(){
    try{
      if(!local){const saved=localStorage.getItem(key);state=saved?JSON.parse(saved):core.emptySelection();}
      state=core.validateSelection(state,pool);error='';
    }catch(e){error='Instagram-Auswahl nicht lesbar. Bitte zuerst in der Instagram-Übersicht prüfen.';}
  }
  refreshBrowser();
  window.InstagramCalendarGuard={
    update(next){state=core.validateSelection(next,pool);},
    conflict(sourceId){
      refreshBrowser();
      if(error)return error;
      const chosen=pool.find(item=>item.source_id===sourceId&&state.items[item.id]?.selected);
      return chosen?'Motiv für Instagram gewählt ('+(chosen.artist||'Originalfoto')+'). Dort zuerst abwählen.':'';
    },
    async check(next,previous){
      if(local){
        const response=await fetch(document.body.dataset.prefix+'api/instagram/auswahl',{cache:'no-store'});
        if(!response.ok)throw Error('Instagram-Auswahl konnte nicht geprüft werden.');
        state=core.validateSelection(await response.json(),pool);error='';
      }else refreshBrowser();
      if(error)throw Error(error);
      core.assertCalendarChange(next,previous,state,pool,policy);
    }
  };
})();
