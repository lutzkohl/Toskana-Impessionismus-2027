/* Browser-side production of the same slides shown in the preview. */
(() => {
  'use strict';
  async function renderFiles(row,bytes){
    if(row.format==='original')return [{name:row.filename,data:bytes}];
    const url=URL.createObjectURL(new Blob([bytes],{type:'image/jpeg'}));
    try {
      const image=new Image();image.src=url;await image.decode();
      if(image.naturalWidth!==row.width||image.naturalHeight!==row.height)throw Error('Die Bildmaße haben sich geändert. Bitte die Seite neu laden.');
      const slides=window.InstagramCore.slides(image.naturalWidth,image.naturalHeight,row.format,row.final_frame),files=[];
      for(const [index,slide] of slides.entries()){
        const canvas=document.createElement('canvas');canvas.width=slide.width;canvas.height=slide.height;
        const ctx=canvas.getContext('2d');if(!ctx)throw Error('Bildexport wird von diesem Browser nicht unterstützt.');
        ctx.fillStyle='#f7f5ef';ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.imageSmoothingQuality='high';
        const draw=slide.draw;ctx.drawImage(image,draw.x,draw.y,draw.width,draw.height);
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.94));
        if(!blob)throw Error('Eine Swipe-Seite konnte nicht erzeugt werden.');
        files.push({name:row.files[index],data:new Uint8Array(await blob.arrayBuffer())});
      }
      return files;
    }finally{URL.revokeObjectURL(url);}
  }
  window.InstagramMedia={renderFiles};
})();
