import {decompress,loRom,word,tiles,palette} from './binary.mjs';

// CODE_85AFA0: follow the actual long operands, including relocated 48/56-team tables.
const table=(rom,read)=>{const p=loRom(read);if(rom[p]!==0xbf)throw new Error('Fotografía de selección no compatible.');return loRom((word(rom,p+1)|rom[p+3]<<16)|0x8000);};
const record=(rom,read,team,stride=2)=>table(rom,read)+team*stride;
export function teamPhotoPalettes(rom,team){
 const specs=[['Uniforme de la foto',0x85afbc,6,15],['Portero de la foto',0x85afc3,7,15],['Piel y pelo de la foto',0x85afca,3,11]];
 const result=specs.map(([label,read,slot,count])=>({label,slot,count,offset:loRom(0x890000|word(rom,record(rom,read,team)))+2}));
 for(const [delta,slot] of [[0,2],[1,4]]){const i=rom[record(rom,0x85afd1,team)+delta],offset=loRom(0x890000|word(rom,loRom(0x82f945)+i))+2;result.push({label:'Piel alternativa de la foto',slot,count:11,offset});}
 return result.map(p=>({...p,colors:palette(rom,p.offset,p.count)}));
}
export function teamPhotoResource(rom,team){
 const specs=[[0x9b9935,0x7400],[0x9b9faf,0x7900],[0x9b9fe3,0x79e0],[0x9ba3d0,0x78e0],[0x9ba078,0x7b00],[0x9ba1b0,0x7c00],[0xa18f86,0x7a80],[0xa1904e,null],[0xa18e38,null]];
 const strips=[],tileOwners=new Map();
 const parts=specs.map(([address,dest],part)=>{const offset=loRom(address),data=decompress(rom,offset);strips.push(tiles(data,4,1));if(dest!==null)for(let t=0;t<data.length/32;t++)tileOwners.set((dest-0x6000)/16+t,{part,tile:t});return {id:`graphic:${offset}`,offset,capacity:word(rom,offset)&0x7fff,decodedSize:data.length,bpp:4,columns:1,compressed:true,interleaved:!!(word(rom,offset)&0x8000)};});
 let variant=rom[record(rom,0x85b000,team,1)]*4;if(variant&0x200)variant+=0x200;
 for(let i=0;i<5;i++){const index=i*2,base=[0,0x500,0xc00,0x1800,0x1d00][i],size=i===2?128:64;let source=base+(i===2?variant*2:variant);if(source&0x200)source+=0x200;const dest=0x7820+(index+(index>=6?2:0))*16;
  for(let row=0;row<2;row++)for(let t=0;t<size/32;t++){const byte=source+row*0x200+t*32;tileOwners.set((dest-0x6000)/16+row*16+t,{part:byte<8192?7:8,tile:(byte%8192)/32});}
 }
 const data=decompress(rom,loRom(0x98a817)),count=word(data,1),base=3+data[0];
 const frame=pointer=>{if(!pointer)return [];const start=(pointer-0x5600)/2;let sum=0,f=0;while(sum<start&&f<data[0])sum+=data[3+f++];if(sum!==start||f>=data[0])throw new Error('Composición de foto no compatible.');return Array.from({length:data[3+f]},(_,i)=>{const v=[0,1,2,3].map(p=>data[base+count*p+start+i]),size=v[3]&16?16:8;return {x:v[0]-(size===16?4:0),y:(v[1]>127?v[1]-256:v[1])-(size===16?4:0),tile:v[2]|(v[3]&1)<<8,attr:v[3],size};});};
 const pose=rom[record(rom,0x85b133,team,1)],shape=rom[record(rom,0x85b082,team,1)],head=rom[record(rom,0x85b0bd,team,1)]&1,goalie=rom[record(rom,0x85b0f8,team,1)],accessory=word(rom,record(rom,0x85b114,team));
 const groups=[[word(rom,loRom(0x82f5f8)+shape),6],[word(rom,loRom(0x82f608)+shape),4],[head?0:word(rom,loRom(0x82f600)+shape),3],[head?0:word(rom,loRom(0x82f610)+shape),3],[word(rom,loRom(0x82f618)+goalie),7],[accessory===65535?0:accessory,2],[pose===255?0:word(rom,loRom(0x82f670)+pose),4]];
 const colors=Array(128).fill('transparent');for(const p of teamPhotoPalettes(rom,team))colors.splice(p.slot*16+1,p.count,...p.colors);
 const matrix=Array.from({length:80},()=>Array(112).fill(0)),owners=matrix.map(row=>row.map(()=>null)),layers=matrix.map(row=>row.map(()=>[]));
 // Later menu objects overlay earlier ones; lower OAM entries win within a frame.
 for(const [pointer] of [groups[5],groups[4],groups[1],groups[0],groups[2],groups[3],groups[6]])for(const s of frame(pointer).reverse())for(let y=0;y<s.size;y++)for(let x=0;x<s.size;x++){
  const fx=s.attr&64?s.size-1-x:x,fy=s.attr&128?s.size-1-y:y,t=s.tile+(fx>>3)+(fy>>3)*16,o=tileOwners.get(t),px=s.x+x,py=s.y+y;if(!o||!matrix[py]||px<0||px>=112)continue;
  const slot=s.attr>>1&7,sx=fx%8,sy=o.tile*8+fy%8,pixel=strips[o.part][sy]?.[sx];if(pixel===undefined)throw new Error('Tile de foto fuera de su recurso.');layers[py][px].push({part:o.part,x:sx,y:sy,paletteBase:slot*16});if(pixel||!owners[py][px]){if(pixel)matrix[py][px]=slot*16+pixel;owners[py][px]={part:o.part,x:sx,y:sy,paletteBase:slot*16};}
 }
 return {id:`team-photo:${team}`,kind:'team-photo',label:'Foto del equipo en selección',team,shared:true,bpp:8,parts,matrix,owners,layers,colors,editable:owners.map(row=>row.map(Boolean)),capacity:parts.reduce((n,p)=>n+p.capacity,0),columns:14};
}

export function photoColorIndex(resource,point,pixel){
 const owner=resource.owners[point.y]?.[point.x];if(!owner||pixel===0||resource.colors[pixel]==='transparent')return 0;
 const base=owner.paletteBase;if(pixel>base&&pixel<base+16)return pixel;
 const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)),source=rgb(resource.colors[pixel]);let best=1,distance=Infinity;
 for(let i=1;i<16;i++){const color=resource.colors[base+i];if(!color||color==='transparent')continue;const d=rgb(color).reduce((n,v,k)=>n+(v-source[k])**2,0);if(d<distance){distance=d;best=i;}}
 return base+best;
}
export function normalizePhotoDrawing(resource,matrix,before){
 const changes=new Map();matrix.forEach((row,y)=>row.forEach((pixel,x)=>{const owner=resource.owners[y][x];if(owner&&pixel!==before[y][x])changes.set(`${owner.part}:${owner.x}:${owner.y}`,photoColorIndex(resource,{x,y},pixel)%16);}));
 return matrix.map((row,y)=>row.map((pixel,x)=>{const owner=resource.owners[y][x],key=owner&&`${owner.part}:${owner.x}:${owner.y}`;return changes.has(key)?(changes.get(key)?owner.paletteBase+changes.get(key):0):pixel;}));
}
