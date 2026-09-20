'use strict';
(function(root){
  const months=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  function conflicts(candidate,month,state,catalog,coverId) {
    const occupied=catalog.filter(i=>i.id!==candidate.id&&state.items[i.id]?.month&&state.items[i.id].month!==month)
      .map(item=>({item,month:state.items[item.id].month}));
    const cover=catalog.find(i=>i.id===coverId);
    if(cover)occupied.unshift({item:cover,month:'cover'});
    return occupied.flatMap(slot=>{
      const kind=slot.item.place_slug===candidate.place_slug?'place':slot.item.artist.slug===candidate.artist.slug?'artist':null;
      if(!kind)return [];
      const name=kind==='place'?candidate.place:candidate.artist.name;
      const sheet=slot.month==='cover'?'auf der Titelseite':'im '+months[slot.month-1];
      return [{kind,imageId:slot.item.id,month:slot.month,label:name+' ist bereits '+sheet+' vertreten.'}];
    });
  }
  function assertUnique(state,catalog,coverId) {
    for(const item of catalog) {
      const month=state.items[item.id]?.month;
      if(!month)continue;
      const clash=conflicts(item,month,state,catalog,coverId);
      if(clash.length)throw Error(clash.map(c=>c.label).join(' ')+' Jeder Ort und jeder Maler kommt nur einmal vor.');
    }
  }
  const api={conflicts,assertUnique};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.CalendarSelectionRules=api;
})(typeof window==='object'?window:globalThis);
