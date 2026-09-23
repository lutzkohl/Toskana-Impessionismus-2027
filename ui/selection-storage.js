/* Compare the loaded bytes at write time, even before a storage event arrives. */
(function(root){
  'use strict';
  function write(storage,key,lastRaw,next){
    const current=storage.getItem(key);
    if(current!==lastRaw)throw Error('Die Auswahl wurde in einem anderen Fenster geändert. Bitte neu laden.');
    const revision=current===null?next.revision:JSON.parse(current).revision;
    if(!Number.isSafeInteger(revision)||revision<0)throw Error('Ungültiger Speicherstand. Bitte die bisherige Auswahl sichern.');
    const state={...next,revision:revision+1},raw=JSON.stringify(state);
    storage.setItem(key,raw);
    return {state,raw};
  }
  if(typeof module==='object'&&module.exports)module.exports={write};else root.SelectionStorage={write};
})(typeof globalThis!=='undefined'?globalThis:this);
