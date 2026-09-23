(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MapCore=factory();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 function entries(layer,pool,calendar,instagram,policy,draft){const cal=calendar===null?draft:calendar;return pool.flatMap(i=>{const cover=i.id===policy.cover_image_id,month=cal?.items?.[i.id]?.month||null,planned=cal?.items?.[i.id]?.draft===true,ig=instagram?.items?.[i.id]?.selected===true;if(!cover&&!month&&!planned&&!(layer==='all'&&ig))return [];return [{...i,uses:[...(cover?['Titelseite']:month?['Kalender · '+String(month).padStart(2,'0')]:planned?['Kalenderentwurf']:[]),...(layer==='all'&&ig?['Instagram']:[])]}];});}
 function valid(p){return !!p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;}
 function groups(rows,locations){const groups=new Map();for(const item of rows){const p=locations[item.source_id];if(!valid(p))continue;const key=p.lat+','+p.lon;if(!groups.has(key))groups.set(key,{...p,items:[]});groups.get(key).items.push(item);}return [...groups.values()];}
 return {entries,groups,valid};
});
