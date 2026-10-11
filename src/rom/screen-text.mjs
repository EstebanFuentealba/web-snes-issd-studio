import {loRom,word,decompress,tiles,palette} from './binary.mjs';
import {encodeTiles} from './encode-tiles.mjs';
import {compress} from './compression.mjs';

// DATA_82850C loads the splash atlas at VRAM $2000. BG1 maps use
// palettes 3/4 mask BG2’s textured fill (palettes 2/5). Palette scripts
// DATA_818980..8189A0 upload 64 colors starting at CGRAM $20.
const TITLES=[
 ['short-league','SHORT LEAGUE',0x91f925,0x89c18e,80,64],
 ['short-tournament','SHORT TOURNAMENT',0x91faa9,0x89c210,48,128],
 ['international','INTERNATIONAL',0x91f79c,0x89c008,80,64],
 ['world-series','WORLD SERIES · 1ST SEASON',0xa7dda2,0x89c08a,48,128],
];
function part(rom,address,bpp){
 const offset=loRom(address),data=decompress(rom,offset);
 return {id:`graphic:${offset}`,offset,capacity:word(rom,offset)&0x7fff,bpp,columns:1,compressed:true,interleaved:!!(word(rom,offset)&0x8000),decodedSize:data.length};
}
function compose(rom,id,label,parts,layers,colors,top,height){
 const strips=parts.map(p=>tiles(decompress(rom,p.offset),p.bpp,1));
 const matrix=Array.from({length:height},()=>Array(256).fill(0)),owners=matrix.map(row=>row.map(()=>null));
 for(const layer of layers){
  const map=decompress(rom,loRom(layer.map));
  for(let y=0;y<height;y++)for(let x=0;x<256;x++){
   const py=(y+top+(layer.scroll||0)+256)%256,entry=word(map,((py>>3)*32+(x>>3))*2),tile=(entry&1023)-layer.base;
   if(tile<0||tile*8+7>=strips[layer.part].length)continue;
   const sx=entry&0x4000?7-x%8:x%8,sy=tile*8+(entry&0x8000?7-py%8:py%8);
   const pixel=strips[layer.part][sy][sx],paletteBase=layer.paletteBase(entry);
   if(pixel||!owners[y][x]){
    if(pixel)matrix[y][x]=paletteBase+pixel;
    owners[y][x]=layer.blank?.includes(tile)?null:{part:layer.part,x:sx,y:sy,paletteBase};
   }
  }
 }
 return {id,kind:'screen-text',label,shared:true,bpp:colors.length>16?8:parts[0].bpp,columns:32,capacity:parts.reduce((n,p)=>n+p.capacity,0),parts,matrix,owners,editable:owners.map(row=>row.map(Boolean)),colors};
}
export function screenTextResources(rom){
 const atlas=part(rom,0xa6e80a,4);
 const titles=TITLES.map(([id,label,map,pal,top,height])=>{
  const colors=palette(rom,loRom(pal),64);colors[0]=colors[16]=colors[32]=colors[48]='transparent';
  return compose(rom,`screen-text:${id}`,`Título de modo · ${label}`,[atlas],[{part:0,map:0xa7dfc8,base:0,blank:[0],scroll:height===64?-32:0,paletteBase:e=>((e>>10)&7)===5?48:0},{part:0,map,base:0,blank:[1],paletteBase:e=>((e>>10)&7)===4?32:16}],colors,top,height);
 });
 // DATA_82977D: medium 2bpp letters at VRAM $5480 (tile $90
 // relative to BG3's $5000); the exclamation uses the font at $53E0.
 const colors=palette(rom,loRom(0x89f964)+16,4);colors[0]='transparent';
 titles.push(compose(rom,'screen-text:password','Contraseña · ENTER PASSWORD',
  [part(rom,0x9b8337,2),part(rom,0x9b8000,2)],
  [{part:0,map:0xaaf469,base:144,paletteBase:()=>0},{part:1,map:0xaaf469,base:124,paletteBase:()=>0}],colors,16,16));
 return titles;
}
function localColor(resource,pixel,owner){
 if(pixel===0||resource.colors[pixel]==='transparent')return 0;
 const count=1<<resource.parts[owner.part].bpp,base=owner.paletteBase;
 if(pixel>base&&pixel<base+count)return pixel-base;
 const rgb=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)),source=rgb(resource.colors[pixel]);
 let best=1,distance=Infinity;
 for(let i=1;i<count;i++){
  const d=rgb(resource.colors[base+i]).reduce((n,v,k)=>n+(v-source[k])**2,0);
  if(d<distance){distance=d;best=i;}
 }
 return best;
}
export function screenTextPatches(original,current,resource,matrix){
 if(matrix.length!==resource.matrix.length||matrix.some(row=>row.length!==256))throw new Error('La resolución debe conservarse.');
 const strips=resource.parts.map(p=>tiles(decompress(current,p.offset),p.bpp,1)),changed=new Map();
 matrix.forEach((row,y)=>row.forEach((pixel,x)=>{
  if(!Number.isInteger(pixel)||pixel<0||pixel>=resource.colors.length)throw new Error('Índice de paleta inválido.');
  if(pixel===resource.matrix[y][x])return;
  const owner=resource.owners[y][x];if(!owner)throw new Error('Ese píxel queda fuera de la zona editable del recurso.');
  const value=localColor(resource,pixel,owner),key=`${owner.part}:${owner.x}:${owner.y}`;
  if(changed.has(key)&&changed.get(key)!==value)throw new Error('El dibujo asigna colores distintos al mismo píxel reutilizado.');
  changed.set(key,value);strips[owner.part][owner.y][owner.x]=value;
 }));
 return resource.parts.map((p,i)=>{
  const raw=encodeTiles(strips[i],p.bpp),pristine=decompress(original,p.offset),capacity=word(original,p.offset)&0x7fff;
  const same=(a,b)=>a.length===b.length&&a.every((v,j)=>v===b[j]);
  const bytes=original.slice(p.offset,p.offset+capacity);
  if(!same(raw,pristine)){
   if(same(raw,decompress(current,p.offset)))bytes.set(current.subarray(p.offset,p.offset+capacity));
   else{const encoded=compress(raw,p.interleaved);if(encoded.length>capacity)throw new Error(`El gráfico necesita ${encoded.length} bytes; solo hay ${capacity}. Reduce detalle o restaura píxeles.`);bytes.set(encoded);}
  }
  return {id:p.id,label:resource.label,offset:p.offset,bytes};
 });
}
