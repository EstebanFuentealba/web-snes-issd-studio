import {loRom,word,tiles,palette} from './binary.mjs';

// DATA_82F03B..DATA_82F117: five directions, four standing poses and
// five running frames each. Opposite directions reuse these tiles mirrored.
// Descriptors point to raw OAM in bank $88 and length-prefixed DMA in $AD.
export function dogRefereeGraphics(rom) {
  const directions=['arriba','diagonal arriba','lateral','diagonal abajo','abajo'];
  const colors=palette(rom,loRom(0x89be62),16);colors[0]='transparent';
  const resources=[];
  for(let direction=0;direction<5;direction++)for(let pose=0;pose<9;pose++){
    const running=pose>=4,index=running?pose-4:pose;
    const address=running?0x82f09f+direction*25+index*5:0x82f03b+direction*20+index*5;
    const descriptor=loRom(address),oam=loRom(0x880000|word(rom,descriptor));
    const dma=loRom(word(rom,descriptor+2)|rom[descriptor+4]<<16);
    const topSize=word(rom,dma),parts=[];
    const addPart=(offset,size)=>{
      if(!size)return;
      parts.push({id:`graphic:${offset}`,offset,capacity:size,decodedSize:size,bpp:4,columns:size/32,compressed:false});
    };
    addPart(dma+2,topSize);
    // Up/down running frames contain only a single DMA row.
    if(!running||(direction!==0&&direction!==4)){
      const bottom=dma+2+topSize;addPart(bottom+2,word(rom,bottom));
    }
    // Up run 5 transfers two tiles; OAM still uses tile 2 left by run 4.
    const retainedTile=address===0x82f0b3;
    if(retainedTile)addPart(loRom(0xad954b),96);
    const strips=parts.map(p=>tiles(rom.subarray(p.offset,p.offset+p.capacity),4,p.columns));
    const signed=v=>v>127?v-256:v;
    const sprites=Array.from({length:rom[oam]},(_,i)=>{
      const offset=oam+1+i*4,attr=rom[offset+3],size=attr&16?16:8,adjust=size===16?4:0;
      return {x:signed(rom[offset+1])-adjust,y:signed(rom[offset])-adjust,tile:rom[offset+2],attr,size};
    });
    const left=Math.min(...sprites.map(s=>s.x)),top=Math.min(...sprites.map(s=>s.y));
    const width=Math.ceil((Math.max(...sprites.map(s=>s.x+s.size))-left)/8)*8;
    const height=Math.ceil((Math.max(...sprites.map(s=>s.y+s.size))-top)/8)*8;
    const matrix=Array.from({length:height},()=>Array(width).fill(0)),owners=matrix.map(row=>row.map(()=>null));
    for(const s of [...sprites].reverse())for(let y=0;y<s.size;y++)for(let x=0;x<s.size;x++){
      const fx=s.attr&64?s.size-1-x:x,fy=s.attr&128?s.size-1-y:y;
      const tile=s.tile+(fx>>3)+(fy>>3)*16,part=retainedTile&&tile===2?1:tile>=16?1:0;
      const sx=(tile%16)*8+fx%8,sy=fy%8,pixel=strips[part]?.[sy]?.[sx];
      if(pixel===undefined)throw new Error('Composición del árbitro perro no compatible.');
      const px=s.x-left+x,py=s.y-top+y;
      if(pixel||!owners[py][px]){matrix[py][px]=pixel;owners[py][px]={part,x:sx,y:sy};}
    }
    resources.push({id:`dog-sprite:${address}`,kind:'sprite',global:true,shared:true,
      label:`Árbitro perro · ${directions[direction]} · ${running?'carrera':'quieto'} ${index+1}`,
      bpp:4,columns:width/8,capacity:parts.reduce((sum,p)=>sum+p.capacity,0),parts,owners,
      editable:owners.map(row=>row.map(Boolean)),matrix,colors});
  }
  return resources;
}

// One row per direction; columns 1–4 stand, columns 5–9 run. Deduplicate
// DMA blocks so shared poses write each native tile range only once.
export function dogRefereeSheet(rom) {
  const poses=dogRefereeGraphics(rom),cell=40,width=9*cell,height=5*cell;
  const parts=[],indices=new Map();
  const matrix=Array.from({length:height},()=>Array(width).fill(0));
  const owners=matrix.map(row=>row.map(()=>null));
  const frames=poses.map((pose,index)=>{
    const remap=pose.parts.map(part=>{
      if(!indices.has(part.id)){indices.set(part.id,parts.length);parts.push(part);}
      return indices.get(part.id);
    });
    const x=index%9*cell+Math.floor((cell-pose.matrix[0].length)/2);
    const y=Math.floor(index/9)*cell+cell-4-pose.matrix.length;
    pose.matrix.forEach((row,py)=>row.forEach((pixel,px)=>{
      matrix[y+py][x+px]=pixel;
      const owner=pose.owners[py][px];
      if(owner)owners[y+py][x+px]={...owner,part:remap[owner.part]};
    }));
    return {id:pose.id,x,y,width:pose.matrix[0].length,height:pose.matrix.length};
  });
  return {id:'dog-referee:sheet',kind:'sprite',global:true,shared:true,
    label:'Árbitro perro · todos los sprites',bpp:4,columns:width/8,
    capacity:parts.reduce((sum,part)=>sum+part.capacity,0),parts,owners,frames,
    editable:owners.map(row=>row.map(Boolean)),matrix,colors:poses[0].colors};
}
