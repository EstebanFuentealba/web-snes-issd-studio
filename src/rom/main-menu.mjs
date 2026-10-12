import {externalDeluxeLayout} from './external-layout.mjs';
import {EXTRA_MENU_GLYPHS,expandedMenuFont} from './menu-font.mjs';
import {loRom,word,decompress,tiles,palette} from './binary.mjs';
import {compress} from './compression.mjs';

// AssetPointersAndFiles: COD_TopmostMainMenuText, large letters, panel and BG2.
// DATA_828E9F expands OAM into WRAM $4000. Expanded frames have 32 slots;
// update DATA_82F3AA to point to their 64-byte records (512 bytes total).
const SOURCE=0x989fb8,LOADER=loRom(0x828ea0),POOL=loRom(0xaee500),SIZE=1024;
const FRAME_ORDER=[0,1,3,7,4,2,6,5]; // Native navigation lists the left column, then the right.
const FONT_POOL=loRom(0xa4e17f),FONT_SIZE=2689,FONT_LOADER=loRom(0x828e58),FRAME_TABLE=loRom(0x82f3aa);
export const MAIN_MENU_RULES=[['main-menu:layout',POOL,SIZE],['main-menu:loader',LOADER,3],['main-menu:font',FONT_POOL,FONT_SIZE],['main-menu:font-loader',FONT_LOADER,3],['main-menu:frames',FRAME_TABLE,32]];
export const MENU_BUTTONS=[
 {label:'OPEN GAME',frame:0,column:0,row:0},
 {label:'SCENARIO',frame:4,column:1,row:0},
 {label:'INTERNATIONAL',frame:1,column:0,row:1},
 {label:'PENALTY KICK',frame:2,column:1,row:1},
 {label:'WORLD SERIES',frame:3,column:0,row:2},
 {label:'TRAINING',frame:6,column:1,row:2},
 {label:'PASSWORD',frame:7,column:0,row:3},
 {label:'OPTIONS',frame:5,column:1,row:3},
];
const GLYPHS={A:0,C:2,D:4,E:6,G:8,K:10,L:12,M:14,N:32,O:34,P:36,R:38,S:40,T:42,W:44,Y:46};
export const MENU_CHARACTERS='ABCDEFGHIJKLMNOPQRSTUVWXYZ -';
const ALL_GLYPHS={...GLYPHS,...EXTRA_MENU_GLYPHS};
const fontPointer=rom=>rom[FONT_LOADER+2]<<16|word(rom,FONT_LOADER);
const extended=rom=>fontPointer(rom)===0xa4e17f;
const fontData=rom=>extended(rom)?decompress(rom,FONT_POOL):expandedMenuFont(rom);
const equal=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const signed=n=>n>127?n-256:n;
const pointer=rom=>rom[LOADER+2]<<16|word(rom,LOADER);
function layout(rom){
 const address=pointer(rom);
 if(!externalDeluxeLayout(rom)&&address!==SOURCE&&loRom(address)!==POOL)throw new Error('Cargador del menú principal no compatible.');
 const data=decompress(rom,loRom(address)),count=word(data,1),base=3+data[0];
 if(data[0]!==8||data.length!==11+count*4||(!externalDeluxeLayout(rom)&&![89,256].includes(count))||count<1||count>512||data.slice(3,11).reduce((n,c)=>n+c,0)!==count||(count===256&&!data.slice(3,11).every(c=>c===32)))throw new Error('Composición del menú principal no compatible.');
 return {data,count,base};
}
function frameSprites(rom,frame){
 const {data,count,base}=layout(rom),start=data.slice(3,3+frame).reduce((n,c)=>n+c,0);
 return Array.from({length:data[3+frame]},(_,i)=>({x:data[base+start+i],y:data[base+count+start+i],tile:data[base+count*2+start+i],attr:data[base+count*3+start+i]}));
}
export function menuButtonLines(rom,index){
 const letters=frameSprites(rom,MENU_BUTTONS[index].frame).filter(s=>![127,128].includes(s.y)&&![65,66,67,68].includes(s.tile)).map(s=>({
  ...s,x:signed(s.x)-(s.attr&16?8:4),y:signed(s.y)-(s.attr&16?8:4)-(s.tile===69?4:0),character:s.tile===64?'I':s.tile===69?'-':Object.keys(ALL_GLYPHS).find(c=>ALL_GLYPHS[c]===s.tile),
 }));
 if(letters.some(s=>!s.character))return ['', ''];
 const rows=[...new Set(letters.map(s=>s.y))].sort((a,b)=>a-b);
 return [0,1].map(row=>letters.filter(s=>s.y===rows[row]).sort((a,b)=>a.x-b.x).filter((s,i,a)=>!i||s.character!=='-'||a[i-1].character!=='-').map((s,i,a)=>(i&&s.x-a[i-1].x>(a[i-1].character==='I'?8:a[i-1].character==='W'?23:15)+3?' ':'')+s.character).join(''));
}
function writeMenu(original,current,frames){
 if(frames.reduce((n,f)=>n+f.filter(s=>![127,128].includes(s.y)).length,0)>128)throw new Error('El menú admite hasta 128 sprites visibles en total. Acorta otro rótulo.');
 const stock=MENU_BUTTONS.map((_,frame)=>frameSprites(original,frame));
 const pristine=frames.every((f,i)=>JSON.stringify(f.filter(s=>![127,128].includes(s.y)))===JSON.stringify(stock[i].filter(s=>![127,128].includes(s.y))))&&(!extended(current)||equal(fontData(current),expandedMenuFont(original)));
 const patches=MAIN_MENU_RULES.map(([id,offset,size])=>({id,offset,bytes:original.slice(offset,offset+size),label:'Menú principal · alfabeto y rótulos'}));
 if(pristine)return patches;
 for(const [offset,size,active] of [[POOL,SIZE,pointer(original)!==SOURCE],[FONT_POOL,FONT_SIZE,extended(original)]])if(!active&&!original.slice(offset,offset+size).every(b=>b===255))throw new Error('El espacio reservado para el menú principal está ocupado.');
 const data=new Uint8Array(1035);data.set([8,0,1,...Array(8).fill(32)]);
 frames.forEach((frame,f)=>{
  if(frame.length>32)throw new Error('Esta opción admite hasta 32 sprites.');
  const records=frame.slice();while(records.length<32)records.push({x:0,y:127,tile:0,attr:1});
  records.forEach((s,i)=>[s.x,s.y,s.tile,s.attr].forEach((v,p)=>data[11+p*256+f*32+i]=v));
 });
 for(const [patch,bytes] of [[patches[0],data],[patches[2],fontData(current)]]){
  const encoded=compress(bytes);if(encoded.length>patch.bytes.length)throw new Error('El menú principal excede su espacio reservado.');patch.bytes.fill(255);patch.bytes.set(encoded);
 }
 patches[1].bytes.set([0,0xe5,0xae]);patches[3].bytes.set([0x7f,0xe1,0xa4]);
 for(let index=0;index<8;index++){
  const address=0x4000+FRAME_ORDER[index]*64;patches[4].bytes.set([address&255,address>>>8,128,120],index*4);
 }
 return patches;
}
// Advances include spacing after each letter; that trailing space is not part
// of the image. Measure the opaque pixels (including wide W/Y fragments) so
// native eight-letter labels such as NATIONAL/NACIONAL fit their 112px panel.
function lineMetrics(font,line){
 let cursor=0,left=Infinity,right=-Infinity;
 const include=(tile,dx,size)=>{for(let y=0;y<size;y++)for(let x=0;x<size;x++){const t=tile+(x>>3)+(y>>3)*16;if(font[t*8+y%8]?.[x%8]){left=Math.min(left,cursor+dx+x);right=Math.max(right,cursor+dx+x);}}};
 for(const c of line){
  if(c==='-')include(69,0,8);
  else if(c!==' '){include(ALL_GLYPHS[c],0,16);if(c==='W'){include(66,12,8);include(67,12,8);}if(c==='Y')include(68,12,8);}
  cursor+=c==='I'||c==='-'||c===' '?8:c==='W'?23:15;
 }
 return Number.isFinite(left)?{left,width:right-left+1}:{left:0,width:Math.max(0,cursor-1)};
}
export function mainMenuTextPatches(original,current,index,lines){
 const button=MENU_BUTTONS[index];if(!button||!Array.isArray(lines)||lines.length!==2)throw new Error('Opción del menú inválida.');
 lines=lines.map(s=>String(s).trim().toUpperCase());
 if(!lines.some(Boolean)||lines.some(s=>[...s].some(c=>!MENU_CHARACTERS.includes(c))))throw new Error('Usa letras A–Z, espacios y guiones.');
 const records=[],font=tiles(fontData(current),4,1);
 lines.forEach((line,row)=>{
  const {width,left}=lineMetrics(font,line);
  if(width>112)throw new Error('Cada línea debe caber en 112 píxeles.');
  let x=button.column*128+8+Math.floor((112-width)/2)-left,y=button.row*48+32+(lines.filter(Boolean).length===1?8:row*16);
  for(const c of line){
   if(c==='-')records.push([x+4-128,y+8-120,69,1]);
   else if(c!==' '){records.push([x+8-128,y+8-120,ALL_GLYPHS[c],17]);if(c==='W')records.push([x+16-128,y+4-120,66,1],[x+16-128,y+12-120,67,1]);if(c==='Y')records.push([x+16-128,y+4-120,68,1]);}
   x+=c==='I'||c==='-'||c===' '?8:c==='W'?23:15;
  }
 });
 const frames=Array.from({length:8},(_,f)=>frameSprites(current,f));
 frames[button.frame]=records.map(r=>Object.fromEntries(['x','y','tile','attr'].map((k,i)=>[k,r[i]&255])));
 return writeMenu(original,current,frames);
}
export function restoreMenuButtonPatches(original,current,index){
 const frame=MENU_BUTTONS[index]?.frame;if(frame===undefined)throw new Error('Opción del menú inválida.');
 const frames=Array.from({length:8},(_,f)=>frameSprites(current,f));frames[frame]=frameSprites(original,frame);
 return writeMenu(original,current,frames);
}
export function validateMainMenu(rom,original){
 const a=layout(rom),b=layout(original);
 if(![0x9e8000,0xa4e17f].includes(fontPointer(rom)))throw new Error('Fuente del menú principal inválida.');
 if(a.count===256){
  if(!extended(rom)||fontData(rom).length!==144*32||(word(rom,FONT_POOL)&0x7fff)>FONT_SIZE)throw new Error('Fuente ampliada del menú inválida.');
  for(let i=0;i<8;i++)if(word(rom,FRAME_TABLE+i*4)!==0x4000+FRAME_ORDER[i]*64||word(rom,FRAME_TABLE+i*4+2)!==0x7880)throw new Error('Punteros de opciones inválidos.');
 }else{if(MAIN_MENU_RULES.slice(2).some(([,offset,size])=>rom.slice(offset,offset+size).some((v,i)=>v!==original[offset+i])))throw new Error('Fuente ampliada sin rótulos compatibles.');if(a.data.slice(0,11).some((v,i)=>v!==b.data[i])||extended(rom)||rom.slice(FRAME_TABLE,FRAME_TABLE+32).some((v,i)=>v!==original[FRAME_TABLE+i]))throw new Error('Composición del menú principal no compatible.');}
 let visible=0;
 for(const button of MENU_BUTTONS)for(const s of frameSprites(rom,button.frame)){
  if(![1,17,65].includes(s.attr)||!((a.count===256?Object.values(ALL_GLYPHS):Object.values(GLYPHS)).includes(s.tile)||[64,65,66,67,68,69].includes(s.tile)))throw new Error('Sprite del menú principal inválido.');
  if([127,128].includes(s.y))continue;visible++;
  const x=signed(s.x)+128-(s.attr&16?8:4),y=signed(s.y)+120-(s.attr&16?8:4);
  if(x<button.column*128||x+(s.attr&16?16:8)>(button.column+1)*128||y<button.row*48+24||y+(s.attr&16?16:8)>button.row*48+80)throw new Error('Rótulo fuera de su botón.');
 }
 if(visible>128)throw new Error('El menú admite hasta 128 sprites visibles en total. Acorta otro rótulo.');
 if(pointer(rom)===SOURCE&&MAIN_MENU_RULES.some(([,offset,size])=>rom.slice(offset,offset+size).some((v,i)=>v!==original[offset+i])))throw new Error('Datos del menú sin cargador.');
}
function resource(rom,label,address,bpp,columns,colors){
 const offset=loRom(address),data=decompress(rom,offset);
 return {id:`graphic:${offset}`,shared:true,label,offset,capacity:word(rom,offset)&0x7fff,bpp,columns,compressed:true,interleaved:!!(word(rom,offset)&0x8000),decodedSize:data.length,matrix:tiles(data,bpp,columns),colors};
}
// Rebuild the tilemap in screen order and retain each pixel's source tile,
// including horizontal/vertical flips. The border uses the global UI atlas;
// display it as context, but only the panel's own tiles are writable.
function menuLayer(rom,part,mapAddress,{width,height,top=0,base=0,context=null}){
 const strip=tiles(decompress(rom,part.offset),4,1),map=decompress(rom,loRom(mapAddress));
 const other=context?tiles(decompress(rom,loRom(context)),4,1):null;
 const owners=Array.from({length:height},()=>Array(width).fill(null));
 const matrix=owners.map((row,y)=>row.map((_,x)=>{
  const py=y+top,e=word(map,((py>>3)*32+(x>>3))*2),tile=(e&1023)-base,xx=e&0x4000?7-x%8:x%8,yy=e&0x8000?7-py%8:py%8;
  if(tile>=0&&tile*8+yy<strip.length){owners[y][x]={part:0,x:xx,y:tile*8+yy};return strip[tile*8+yy][xx];}
  return other?.[(e&1023)*8+yy]?.[xx]??0;
 }));
 return {...part,kind:'menu-layer',columns:width/8,compressed:false,parts:[part],matrix,owners,editable:owners.map(row=>row.map(Boolean))};
}
export function mainMenuBackground(rom){
 const background=resource(rom,'Menú principal · fondo azul',0x9ed8ab,4,1,palette(rom,loRom(0x89e49e),16));
 return menuLayer(rom,background,0xa2e9d0,{width:256,height:224,base:384});
}
export function mainMenuGraphics(rom,expand=false){
 const bright=palette(rom,loRom(0x89c856),16);bright[0]='transparent';
 const font=extended(rom)||expand?{id:'main-menu:font',label:'Menú principal · letras grandes compartidas',offset:FONT_POOL,capacity:FONT_SIZE,bpp:4,columns:16,compressed:true,interleaved:false,decodedSize:144*32,matrix:tiles(fontData(rom),4,16),colors:bright}:resource(rom,'Menú principal · letras grandes compartidas',0x9e8000,4,2,bright);
 const panel=resource(rom,'Menú principal · panel compartido',0x9e865c,4,1,palette(rom,loRom(0x89c816),16));
 return [font,menuLayer(rom,panel,0x9dfea3,{width:128,height:48,top:24,base:48,context:0x95fbdc}),mainMenuBackground(rom)];
}
export function mainMenuPreview(rom,selected=0){
 const colors=Array(256).fill('#000000'),matrix=Array.from({length:224},()=>Array(256).fill(0));
 const bg=tiles(decompress(rom,loRom(0x9ed8ab)),4,1),bgMap=decompress(rom,loRom(0xa2e9d0));
 colors.splice(0,16,...palette(rom,loRom(0x89e49e),16));
 const panelBytes=new Uint8Array(128*32);panelBytes.set(decompress(rom,loRom(0x95fbdc)));panelBytes.set(decompress(rom,loRom(0x9e865c)),48*32);
 const panel=tiles(panelBytes,4,1),panelMap=decompress(rom,loRom(0x9dfea3));
 colors.splice(16,16,...palette(rom,loRom(0x89c816),16));
 for(let y=0;y<224;y++)for(let x=0;x<256;x++){
  const p=((y>>3)*32+(x>>3))*2;
  for(const [strip,map,subtract,base] of [[bg,bgMap,384,0],[panel,panelMap,0,16]]){
   const e=word(map,p),t=(e&1023)-subtract,xx=e&0x4000?7-x%8:x%8,yy=e&0x8000?7-y%8:y%8;
   const pixel=strip[t*8+yy]?.[xx];if(pixel)matrix[y][x]=base+pixel;
  }
 }
 const font=tiles(extended(rom)?fontData(rom):decompress(rom,loRom(0x9e8000)),4,1),bright=palette(rom,loRom(0x89c856),16);bright[0]='transparent';
 colors.splice(48,16,...bright.map(c=>c==='transparent'?'#000000':c));
 colors.splice(64,16,...palette(rom,loRom(0x89c836),16));
 MENU_BUTTONS.forEach((b,index)=>{
  for(const s of frameSprites(rom,b.frame).reverse()){
   const size=s.attr&16?16:8,left=signed(s.x)+128-(size===16?8:4),top=signed(s.y)+120-(size===16?8:4);
   for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const xx=s.attr&64?size-1-x:x,yy=s.attr&128?size-1-y:y,t=s.tile+(xx>>3)+(yy>>3)*16,pixel=font[t*8+yy%8]?.[xx%8];
    if(pixel&&matrix[top+y]?.[left+x]!==undefined)matrix[top+y][left+x]=(index===selected?48:64)+pixel;
   }
  }
 });
 return {matrix,colors};
}
