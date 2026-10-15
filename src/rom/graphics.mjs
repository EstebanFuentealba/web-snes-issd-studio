import {hasExpandedTeams,EXPANDED,expandedFlagBuffer,EXPANDED_TEAMS} from './expanded-layout.mjs';
import {externalDeluxeLayout} from './external-layout.mjs';
import {MAX_TEAMS,teamCount,hasExtraTeams,hasPhysicalTeams,teamExists,activeTeamIds,teamDataRom,teamPaletteOffset,teamPointer,teamTable} from './team-count.mjs';
import {bootScreenResources,bootScreenPatches} from './boot-screens.mjs';
import {mainMenuGraphics} from './main-menu.mjs';
import {screenTextResources,screenTextPatches} from './screen-text.mjs';
import {compress} from './compression.mjs';
export {compress} from './compression.mjs';
import {hasCustomGroups,readGroups,groupPageTitles} from './groups.mjs';
import { decompress, tiles, word, loRom, palette } from './binary.mjs';
import { titleLegalResources, titleLegalPatches } from './title-legal.mjs';
import {teamPhotoResource} from './team-photo.mjs';
import {dogRefereeSheet} from './dog-referee-graphics.mjs';

import {encodeTiles} from './encode-tiles.mjs';
export {encodeTiles} from './encode-tiles.mjs';

export function rgb555(hex) {
  if(!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error('Color inválido.');
  const values=[1,3,5].map(i=>Math.round(parseInt(hex.slice(i,i+2),16)*31/255));
  const value=values[0]|values[1]<<5|values[2]<<10;
  return Uint8Array.of(value&255,value>>>8);
}

export function graphicResources(rom, team, warnings = []) {
  const compressed=(label,address,bpp,columns,colors)=> {
    const offset=loRom(address), capacity=word(rom,offset)&0x7fff, data=decompress(rom,offset);
    return {id:`graphic:${offset}`,label,offset,capacity,bpp,columns,compressed:true,interleaved:!!(word(rom,offset)&0x8000),matrix:tiles(data,bpp,columns),colors,decodedSize:data.length};
  };
  const optional=(resource,read)=>{try{return read();}catch(error){warnings.push({resource,reason:error.message});return [];}};
  const flagColors=new Array(16).fill('transparent');
  flagColors.splice(12,4,...palette(rom,teamPaletteOffset(rom,teamPointer(rom,0xe7d8,team))+2,4));
  const result=optional('Bandera del equipo',()=>[{id:`flag:${team}`,label:'Bandera completa · independiente',kind:'flag',team,bpp:4,columns:3,capacity:204,colors:flagColors,matrix:flagMatrix(rom,team)}]);
  result.push(...optional('Rótulo del equipo',()=>[{id:`team-label:${team}`,kind:'label',team,label:'Rótulo del equipo',bpp:2,columns:4,capacity:smallLabelMatrix(rom,team).length===8?69:word(rom,loRom(labelBank(rom)<<16|teamPointer(rom,0xe6c1,team)))&0x7fff,matrix:smallLabelMatrix(rom,team),colors:['transparent','#ffffff','#b8b8b8','#555555']}]));
  const kit=palette(rom,teamPaletteOffset(rom,teamPointer(rom,0x1027a,team))+2,16);kit[0]='transparent';
  const raw=(label,start,end,columns,colors=kit)=> {
    const offset=loRom(start),capacity=loRom(end)-offset;
    return {id:`graphic:${offset}`,label,offset,capacity,bpp:4,columns,compressed:false,shared:true,matrix:tiles(rom.slice(offset,offset+capacity),4,columns),colors,decodedSize:capacity};
  };
  const detail=0x980000|teamPointer(rom,0xce8a,team);
  const playerRanges=[[0xa9a7c6,256],[0xa9a8c8,224],[detail,32]];
  result.push(spriteResource(rom,'Detalles de camiseta · vista frontal compartida',playerRanges,0x988472,112,kit,detail===0x98f014?[]:[2]));
  result.push(raw('Números de camisetas · atlas compartido',0x98e5d4,0x98f014,2));
  const goalie=palette(rom,teamPaletteOffset(rom,teamPointer(rom,0x10326,team))+2,11);
  goalie.unshift('transparent');
  while(goalie.length<16) goalie.push('transparent');goalie[0]='transparent';
  result.push(spriteResource(rom,'Portero completo · sprite compartido',[[0x90ccf2,224],[0x90cdd4,192]],0x988846,39,goalie));
  result.push(spriteResource(rom,'Jugador completo · sprite compartido',playerRanges,0x988472,112,kit,[0,1]));
  result.push(raw('Balón · atlas compartido',0x9a8000,0x9a8600,8));
  result.push(dogRefereeSheet(rom));
  for(let hair=1;hair<=13;hair++) result.push(raw(`Pelo ${hair} · atlas compartido`,0x97cd58+(hair-1)*0x300,0x97cd58+hair*0x300,24));
  result.push(...optional('Foto del equipo en selección',()=>[teamPhotoResource(rom,team)]));
  result.push(...optional('Pantallas iniciales',()=>bootScreenResources(rom)),...optional('Rótulos de grupos',()=>selectionGroupGraphics(rom)),...optional('Logo completo de portada',()=>[titleLogo(rom)]),...optional('Fondo rojo de portada',()=>[titleLogo(rom,true)]),...optional('Fotos de portada',()=>titlePortraits(rom)),...optional('Texto legal de portada',()=>titleLegalResources(rom)),...optional('Menú principal',()=>mainMenuGraphics(rom)),...optional('Títulos de modo y contraseña',()=>screenTextResources(rom)));
  return result;
}

export function graphicPatch(original, resource, matrix) {
  const bytes=encodeTiles(matrix,resource.bpp);
  if(bytes.length!==resource.decodedSize) throw new Error('La resolución debe conservarse.');
  const capacity=resource.id==='main-menu:font'?resource.capacity:resource.compressed?word(original,resource.offset)&0x7fff:resource.capacity;
  const encoded=resource.compressed?compress(bytes,resource.interleaved):bytes;
  if(encoded.length>capacity) throw new Error(`El gráfico necesita ${encoded.length} bytes; solo hay ${capacity}. Reduce detalle o restaura píxeles.`);
  const padded=Uint8Array.from(original.subarray(resource.offset,resource.offset+capacity));padded.set(encoded);
  return {id:resource.id,label:resource.label,offset:resource.offset,bytes:padded};
}

// DATA_82F7A4 is referenced only by CODE_85A8FB, the national flag loader.
// Its four source banks are changed together. $AFBD1E..$AFFFFF is documented
// FREE_BYTES (17122 bytes); reserve 84 fixed slots, each fitting worst-case RAW.
export const FLAG_POOL=loRom(0xafbd1e), FLAG_SLOT=102, FLAG_POOL_SIZE=84*FLAG_SLOT;
export const FLAG_TEMPLATE=loRom(0x82f7a4), FLAG_TABLE=0xe730;
export const FLAG_RULES=[['flags:pool',FLAG_POOL,FLAG_POOL_SIZE],['flags:pointers',FLAG_TABLE,168],['flags:loader',FLAG_TEMPLATE,23],['flags:match-loader',0xe715,23],['flags:single-loader',0xeb80,13],['flags:select-script',loRom(0x82fb5d),508],['flags:select-entry',loRom(0x87ad9a),2],['flags:select-map',loRom(0x82f829),84]];
// Selection also keeps stadium tiles at $7F2280..$7F33BF. Retain the old
// flag buffer for 32 countries; extra countries use the menu's unused $3400 area.
export function selectionFlagAddress(team){if(team>=48)return expandedFlagBuffer(team);return team<32?0xa80+team*192:0x3400+(team-32)*192;}
export function flagBank(rom) {if(externalDeluxeLayout(rom))return externalDeluxeLayout(rom).flagBank;return rom[FLAG_TEMPLATE+6];}
export function flagMatrix(rom,team) {
  const bank=flagBank(rom)===0xaf && rom[0xe715+6]!==0xaf && team>=36?0xa7:flagBank(rom);
  return [0,1].flatMap(part=>tiles(decompress(rom,loRom(bank<<16|word(rom,teamTable(rom,FLAG_TABLE)+(externalDeluxeLayout(rom)||hasExtraTeams(rom)||team<42?team:0)*4+part*2))),4,3));
}
export function validateFlagStorage(rom,original) {
  if(hasExtraTeams(rom)){for(let i of hasPhysicalTeams(rom)?activeTeamIds(rom):Array.from({length:MAX_TEAMS},(_,i)=>i)){const off=loRom(flagBank(rom)<<16|teamPointer(rom,FLAG_TABLE,i,4));if((word(rom,off)&0x7fff)>FLAG_SLOT||(word(rom,off+FLAG_SLOT)&0x7fff)>FLAG_SLOT||decompress(rom,off).length!==96||decompress(rom,off+FLAG_SLOT).length!==96||flagMatrix(rom,i).flat().some(p=>p!==0&&p<12))throw new Error("Bandera ampliada inválida.");}return;}
  const bank=flagBank(rom),relocated=bank===0xaf;
  if(bank!==flagBank(original)&&!relocated)throw new Error('Banco de banderas inválido.');
  for(const template of [FLAG_TEMPLATE,0xe715,0xeb80])for(let i=0;i<(template===0xeb80?13:23);i++)if(rom[template+i]!==((template===0xeb80?[6,11]:[6,11,16,21]).includes(i)&&relocated?0xaf:original[template+i]))throw new Error('Cargador de banderas inválido.');
  if(relocated){
    const script=loRom(0x82fb5d);if(word(rom,loRom(0x87ad9a))!==0xfb5d||word(rom,script)!==1||word(rom,script+506)!==65535)throw new Error('Precarga de banderas inválida.');
    for(let i=0;i<42;i++){const dest=selectionFlagAddress(i);if(word(rom,loRom(0x82f829)+i*2)!==dest)throw new Error('Mapa de banderas inválido.');for(let part=0;part<2;part++){const off=script+2+(i*2+part)*6;if(word(rom,off)!==dest+part*96||rom[off+2]!==0x7f||word(rom,off+3)!==0xbd1e+(i*2+part)*FLAG_SLOT||rom[off+5]!==0xaf)throw new Error('Fuente de precarga inválida.');}}
  }
  for(let i=0;i<84;i++) {
    const pointer=word(rom,FLAG_TABLE+i*2),expected=relocated?0xbd1e+i*FLAG_SLOT:word(original,FLAG_TABLE+i*2);
    if(pointer!==expected)throw new Error('Puntero de bandera inválido.');
    const offset=loRom(bank<<16|pointer),size=word(rom,offset)&0x7fff;
    if(relocated&&size>FLAG_SLOT)throw new Error('Bandera fuera de su espacio reservado.');
    const bytes=decompress(rom,offset);
    if(bytes.length!==96||tiles(bytes,4,3).flat().some(p=>p!==0&&p<12))throw new Error('Formato de bandera inválido.');
  }
}
export function flagPatches(original,current,team,matrix,legacy=false,force=false) {
  if(matrix.length!==16||matrix.some(row=>row.length!==24))throw new Error('La bandera debe medir 24 × 16.');
  if(hasExtraTeams(current)){if(team<0||team>=teamCount(current))throw new Error("Equipo inválido.");const v3=hasExpandedTeams(current),offset=loRom(v3?EXPANDED.flags:0xb0ca40),bytes=current.slice(offset,offset+(v3?EXPANDED_TEAMS:MAX_TEAMS)*2*FLAG_SLOT);for(let part=0;part<2;part++){const encoded=compress(encodeTiles(matrix.slice(part*8,part*8+8),4));if(encoded.length>FLAG_SLOT)throw new Error("Bandera fuera de su espacio reservado.");bytes.fill(255,(team*2+part)*FLAG_SLOT,(team*2+part+1)*FLAG_SLOT);bytes.set(encoded,(team*2+part)*FLAG_SLOT);}return [{id:v3?"teams56:flags":"teams:flags",offset,bytes,label:"Bandera independiente"}];}
  const all=Array.from({length:42},(_,i)=>i===team?matrix:flagMatrix(legacy&&i>=36?original:current,i));
  if(all.some(m=>m.flat().some(p=>p!==0&&(!Number.isInteger(p)||p<12||p>15))))throw new Error('La bandera usa los colores 12–15 o transparencia.');
  const pristine=all.every((m,i)=>JSON.stringify(m)===JSON.stringify(flagMatrix(original,i)));
  const changes=FLAG_RULES.map(([id,offset,size])=>({id,offset,label:'Banderas independientes',bytes:Uint8Array.from(original.subarray(offset,offset+size))}));
  if(force || !pristine || (flagBank(original)===0xaf&&word(original,loRom(0x87ad9a))!==0xfb5d)) {
    if(!((flagBank(original)===0xa7&&original.subarray(FLAG_POOL,FLAG_POOL+FLAG_POOL_SIZE).every(b=>b===255))||flagBank(original)===0xaf))throw new Error('La ROM no tiene libre el espacio verificado para las banderas.');
    if(flagBank(original)===0xa7&&!original.subarray(loRom(0x82fb5d),loRom(0x82fb5d)+508).every(b=>b===255))throw new Error('El espacio de precarga de banderas está ocupado.');
    all.forEach((m,i)=>[0,1].forEach(part=>{
      const encoded=compress(encodeTiles(m.slice(part*8,part*8+8),4));
      if(encoded.length>FLAG_SLOT)throw new Error('La bandera excede su espacio reservado.');
      const slot=i*2+part,pointer=0xbd1e+slot*FLAG_SLOT;
      changes[0].bytes.set(encoded,slot*FLAG_SLOT);changes[1].bytes.set([pointer&255,pointer>>>8],slot*2);
    }));
    for(const change of changes.filter(p=>['flags:loader','flags:match-loader','flags:single-loader'].includes(p.id)))for(const i of (change.id==='flags:single-loader'?[6,11]:[6,11,16,21]))change.bytes[i]=0xaf;
    const script=changes.find(p=>p.id==='flags:select-script').bytes,map=changes.find(p=>p.id==='flags:select-map').bytes;
    script.set([1,0]);script.set([255,255],506);
    for(let i=0;i<42;i++){const dest=selectionFlagAddress(i);map.set([dest&255,dest>>>8],i*2);for(let part=0;part<2;part++){const p=0xbd1e+(i*2+part)*FLAG_SLOT,d=dest+part*96;script.set([d&255,d>>>8,0x7f,p&255,p>>>8,0xaf],2+(i*2+part)*6);}}
    changes.find(p=>p.id==='flags:select-entry').bytes.set([0x5d,0xfb]);
  }
  return changes;
}

// Dynamic DMA sends the first tile row to VRAM $6000 and the second to $6100.
// OAM records supply signed positions, 8/16 pixel sizes and horizontal flips.
// The cumulative sprite indices correspond to WRAM $40E0 and $4958.
export function spriteResource(rom,label,ranges,address,start,colors,editableParts=[0,1]) {
  const parts=ranges.map(([address,size])=>{const offset=loRom(address);return {id:`${ranges.length>2&&address===ranges[2][0]?'detail':'graphic'}:${offset}`,offset,capacity:size,bpp:4,columns:size/32,decodedSize:size,compressed:false};});
  const strips=parts.map(p=>tiles(rom.subarray(p.offset,p.offset+p.capacity),4,p.columns));
  const data=decompress(rom,loRom(address)),count=word(data,1),base=3+data[0];
  let sum=0,frame=0;while(sum<start&&frame<data[0])sum+=data[3+frame++];
  if(sum!==start)throw new Error('Composición OAM no compatible.');
  const sprites=Array.from({length:data[3+frame]},(_,i)=>{
    const values=[0,1,2,3].map(p=>data[base+count*p+start+i]);
    const size=values[3]&16?16:8,adjust=size===16?4:0;
    return {x:(values[0]>127?values[0]-256:values[0])-adjust,y:(values[1]>127?values[1]-256:values[1])-adjust,tile:values[2],attr:values[3],size};
  }).filter(s=>s.tile<parts[0].columns||(s.tile>=16&&s.tile<16+parts[1].columns)||(parts[2]&&s.tile===23)); // Render supplied pose tiles plus the jersey overlay.
  const left=Math.min(...sprites.map(s=>s.x)),top=Math.min(...sprites.map(s=>s.y)),width=Math.ceil((Math.max(...sprites.map(s=>s.x+s.size))-left)/8)*8,height=Math.ceil((Math.max(...sprites.map(s=>s.y+s.size))-top)/8)*8;
  const matrix=Array.from({length:height},()=>Array(width).fill(0)),owners=matrix.map(row=>row.map(()=>null));
  // The first OAM entry wins at overlapping opaque pixels, as on SNES.
  for(const s of [...sprites].reverse())for(let y=0;y<s.size;y++)for(let x=0;x<s.size;x++) {
    const fx=s.attr&64?s.size-1-x:x,fy=s.attr&128?s.size-1-y:y,tile=s.tile+Math.floor(fx/8)+Math.floor(fy/8)*16,part=parts[2]&&tile===23?2:tile>=16?1:0,t=part===2?0:tile%16;
    if(t>=parts[part].columns)continue;
    const sx=t*8+fx%8,sy=fy%8,px=s.x-left+x,py=s.y-top+y,pixel=strips[part][sy][sx];
    if(pixel||!owners[py][px]){matrix[py][px]=pixel;owners[py][px]={part,x:sx,y:sy};}
  }
  const editable=owners.map(row=>row.map(o=>!!o&&editableParts.includes(o.part)));
  return {id:editableParts.length===1?`detail-preview:${parts[2].offset}`:`sprite:${parts[0].offset}`,kind:'sprite',editableParts,editable,label,shared:true,bpp:4,columns:width/8,capacity:parts.reduce((n,p,i)=>n+(editableParts.includes(i)?p.capacity:0),0),parts,owners,matrix,colors};
}
export function graphicPatches(original,current,resource,matrix) {
  if(resource.kind==='screen-text')return screenTextPatches(original,current,resource,matrix);
  if(resource.kind==='boot-screen')return bootScreenPatches(original,current,resource.id,matrix);
  if(resource.kind==='title-legal')return titleLegalPatches(original,current,resource.id,matrix);
  if(resource.kind==='group-label')return groupLabelPatches(original,current,resource,matrix);
  if(resource.kind==='flag')return flagPatches(original,current,resource.team,matrix);
  if(resource.kind==='label')return smallLabelPatches(original,current,resource.team,matrix);
  if(!['sprite','composite','portrait','group-label','menu-layer','team-photo'].includes(resource.kind))return [graphicPatch(original,resource,matrix)];
  if(matrix.length!==resource.matrix.length||matrix.some(row=>row.length!==resource.matrix[0].length))throw new Error('La resolución debe conservarse.');
  const strips=resource.parts.map(p=>tiles(p.compressed?decompress(current,p.offset):current.subarray(p.offset,p.offset+p.capacity),p.bpp,p.columns)),changed=new Map();
  matrix.forEach((row,y)=>row.forEach((pixel,x)=>{
    if(!Number.isInteger(pixel)||pixel<0||pixel>=(resource.kind==='sprite'?16:resource.colors.length))throw new Error('Índice de paleta inválido.');
    if(pixel===resource.matrix[y][x])return;
    if(resource.kind==='portrait'&&pixel!==0&&resource.colors[pixel]==='transparent')throw new Error('Color fuera de la paleta de las fotos.');
    const owner=resource.owners[y][x];if(!owner||resource.editable&&!resource.editable[y][x])throw new Error('Ese píxel queda fuera de la zona editable del recurso.');
    if(resource.layers&&pixel===0){for(const layer of resource.layers[y][x]){const key=`${layer.part}:${layer.x}:${layer.y}`;if(changed.has(key)&&changed.get(key)!==0)throw new Error('El dibujo asigna colores distintos al mismo píxel reutilizado.');changed.set(key,0);strips[layer.part][layer.y][layer.x]=0;}return;}
    if(resource.kind==='team-photo'&&pixel>owner.paletteBase&&pixel<owner.paletteBase+16)pixel-=owner.paletteBase;
    else if(['composite','team-photo'].includes(resource.kind))pixel=closestLayerColor(resource.colors,pixel,owner.paletteBase);
    const key=`${owner.part}:${owner.x}:${owner.y}`;
    if(changed.has(key)&&changed.get(key)!==pixel)throw new Error('El dibujo asigna colores distintos al mismo píxel reutilizado.');
    changed.set(key,pixel);strips[owner.part][owner.y][owner.x]=pixel;
  }));
  return resource.parts.flatMap((p,i)=>{
    if(resource.editableParts&&!resource.editableParts.includes(i))return [];
    const source=p.compressed?decompress(current,p.offset):current.subarray(p.offset,p.offset+p.capacity),encoded=encodeTiles(strips[i],p.bpp);
    const pristine=p.compressed?decompress(original,p.offset):original.subarray(p.offset,p.offset+p.capacity);
    if(encoded.length===pristine.length&&encoded.every((b,j)=>b===pristine[j]))return [{id:p.id,offset:p.offset,label:resource.label,bytes:Uint8Array.from(original.subarray(p.offset,p.offset+(p.compressed?word(original,p.offset)&0x7fff:p.capacity)))}];
    if(encoded.length===source.length&&encoded.every((b,j)=>b===source[j]))return [{id:p.id,offset:p.offset,label:resource.label,bytes:Uint8Array.from(current.subarray(p.offset,p.offset+(p.compressed?word(original,p.offset)&0x7fff:p.capacity)))}];
    return [graphicPatch(original,p,strips[i])];
  });
}

function closestLayerColor(colors,pixel,base) {
  if(pixel===0||colors[pixel]==='transparent')return 0;
  const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)),source=rgb(colors[pixel]);let best=1,distance=Infinity;
  for(let i=1;i<16;i++){if(!colors[base+i]||colors[base+i]==='transparent')continue;const d=rgb(colors[base+i]).reduce((n,v,k)=>n+(v-source[k])**2,0);if(d<distance){distance=d;best=i;}}
  return best;
}
// Title: DATA_829975/829987, two BG tilemaps and direct OAM DATA_88ED58.
// DATA_81F5FF positions the text object at ($60,$40), palette E0.
export function titleLogo(rom,backgroundOnly=false) {
  const parts=[0xaa8000,0xaa8f56].map(address=>{const offset=loRom(address),data=decompress(rom,offset);return {id:`graphic:${offset}`,offset,capacity:word(rom,offset)&0x7fff,bpp:4,columns:1,compressed:true,interleaved:!!(word(rom,offset)&0x8000),decodedSize:data.length};});
  const strips=parts.map(p=>tiles(decompress(rom,p.offset),4,1));
  const colors=[...palette(rom,loRom(0x89c292),16),...palette(rom,loRom(0x89c2b4),16),...palette(rom,loRom(0x89c318),16)];colors[0]='transparent';colors[16]=colors[32]='transparent';
  const matrix=Array.from({length:128},()=>Array(256).fill(1)),owners=matrix.map(row=>row.map(()=>null)),layers=matrix.map(row=>row.map(()=>[]));
  for(const address of backgroundOnly?[0xaa8d0c]:[0xaa8d0c,0xaa8e61]) {
    const map=decompress(rom,loRom(address));
    for(let y=0;y<128;y++)for(let x=0;x<256;x++) {
      const entry=word(map,((y>>3)*32+(x>>3))*2),tile=entry&1023,xx=entry&0x4000?7-x%8:x%8,yy=entry&0x8000?7-y%8:y%8,base=((entry>>10)&7)*16,pixel=strips[0][tile*8+yy]?.[xx];
      if(pixel===undefined || base+15>=colors.length)throw new Error('La portada del hack usa tiles o paletas fuera del esquema compatible.');
      if(tile!==1&&tile!==110)layers[y][x].push({part:0,x:xx,y:tile*8+yy,paletteBase:base});
      if(pixel){matrix[y][x]=base+pixel;if(tile!==1)owners[y][x]={part:0,x:xx,y:tile*8+yy,paletteBase:base};}
      else if(tile!==1&&tile!==110&&!owners[y][x])owners[y][x]={part:0,x:xx,y:tile*8+yy,paletteBase:base};
    }
  }
  const offset=loRom(0x88ed58);
  for(let i=backgroundOnly?-1:rom[offset]-1;i>=0;i--) {
    let [y,x,tile,attr]=rom.subarray(offset+1+i*4,offset+5+i*4);x=96+(x>127?x-256:x);y=64+(y>127?y-256:y);const size=attr&16?16:8;
    for(let j=0;j<size;j++)for(let k=0;k<size;k++) {
      const fx=attr&64?size-1-k:k,fy=attr&128?size-1-j:j,t=tile+(fx>>3)+(fy>>3)*16,sx=fx%8,sy=t*8+fy%8,pixel=strips[1][sy]?.[sx];
      if(pixel===undefined || !layers[y+j]?.[x+k])throw new Error('La portada del hack usa sprites fuera del esquema compatible.');
      layers[y+j][x+k].push({part:1,x:sx,y:sy,paletteBase:32});
      if(pixel||!owners[y+j][x+k]){if(pixel)matrix[y+j][x+k]=32+pixel;owners[y+j][x+k]={part:1,x:sx,y:sy,paletteBase:32};}
    }
  }
  // Native backdrop (index 1) also appears inside allocated tiles. Keep its
  // silhouette when importing; filling that padding grows the compressed pool.
  // The text and medal whites use separate palette indices and remain editable.
  const importEditable=owners.map((row,y)=>row.map((o,x)=>!!o&&matrix[y][x]!==1));
  return {id:backgroundOnly?'title-background':'title-logo',kind:'composite',label:backgroundOnly?'Fondo rojo de portada':'Logo completo de portada',layers,importEditable,editableParts:backgroundOnly?[0]:[0,1],shared:true,bpp:8,columns:32,capacity:parts.reduce((n,p)=>n+p.capacity,0),parts,matrix,owners,editable:owners.map(row=>row.map(Boolean)),colors};
}

// Mode 3 BG1 portraits: DATA_82996D uploads 232 8bpp tiles to VRAM $4000.
// DATA_81F61C..81F740 are row scripts: FE starts a new tilemap address,
// FF ends the script. DATA_81864E uploads 144 colors at CGRAM index $20.
export function titlePortraits(rom) {
  const offset=loRom(0xa5cb7f),data=decompress(rom,offset);
  const part={id:`graphic:${offset}`,offset,capacity:word(rom,offset)&0x7fff,bpp:8,columns:1,compressed:true,interleaved:!!(word(rom,offset)&0x8000),decodedSize:data.length};
  const strip=tiles(data,8,1),colors=Array(256).fill('transparent');
  colors.splice(32,144,...palette(rom,loRom(0x89c3fa),144));
  // List in screen order, left to right, while retaining the game's tilemaps.
  return [0x81f740,0x81f6ff,0x81f6b1,0x81f66e,0x81f61c].map((address,index)=>{
    let cursor=loRom(address),position=word(rom,cursor);cursor+=2;
    const entries=[];
    while(rom[cursor]!==255) {
      const tile=rom[cursor++];
      if(tile===254){position=word(rom,cursor);cursor+=2;}
      else {entries.push({x:position%32,y:position>>5,tile});position++;}
    }
    const left=Math.min(...entries.map(e=>e.x)),top=Math.min(...entries.map(e=>e.y));
    const width=(Math.max(...entries.map(e=>e.x))-left+1)*8,height=(Math.max(...entries.map(e=>e.y))-top+1)*8;
    const matrix=Array.from({length:height},()=>Array(width).fill(0)),owners=matrix.map(row=>row.map(()=>null));
    for(const e of entries)for(let y=0;y<8;y++)for(let x=0;x<8;x++){
      const px=(e.x-left)*8+x,py=(e.y-top)*8+y,sy=e.tile*8+y;
      matrix[py][px]=strip[sy][x];owners[py][px]={part:0,x,y:sy};
    }
    return {id:`title-photo:${index}`,kind:'portrait',label:`Foto ${index+1} de portada · ${['izquierda','centro izquierda','centro','centro derecha','derecha'][index]}`,shared:true,bpp:8,columns:width/8,capacity:part.capacity,parts:[part],matrix,owners,editable:owners.map(row=>row.map(Boolean)),colors};
  });
}

// Match labels: CODE_A49130 copies DATA_81E6B4, then reads DATA_81E6C1.
// Keep all 42 table entries usable, including the six hidden All-Star teams.
// $AFDF00 is inside documented FREE_BYTES and beyond the flag pool ending DE96.
export const LABEL_POOL=loRom(0xafdf00),LABEL_SLOT=69,LABEL_POOL_SIZE=42*LABEL_SLOT;
export const LABEL_TEMPLATE=0xe6b4,LABEL_TABLE=0xe6c1;
export const LABEL_RULES=[['labels:pool',LABEL_POOL,LABEL_POOL_SIZE],['labels:pointers',LABEL_TABLE,84],['labels:loader',LABEL_TEMPLATE,13],['labels:select-loader',loRom(0x828f21),256]];
export function labelBank(rom){if(externalDeluxeLayout(rom))return externalDeluxeLayout(rom).labelBank;return rom[LABEL_TEMPLATE+6];}
export function smallLabelMatrix(rom,team){return tiles(decompress(rom,loRom(labelBank(rom)<<16|teamPointer(rom,LABEL_TABLE,team))),2,4);}
export function validateSmallLabelStorage(rom,original){
  if(hasExtraTeams(rom)){for(let i of hasPhysicalTeams(rom)?activeTeamIds(rom):Array.from({length:MAX_TEAMS},(_,i)=>i))if((word(rom,loRom(labelBank(rom)<<16|teamPointer(rom,LABEL_TABLE,i)))&0x7fff)>LABEL_SLOT||decompress(rom,loRom(labelBank(rom)<<16|teamPointer(rom,LABEL_TABLE,i))).length!==64)throw new Error("Rótulo ampliado inválido.");return;}
  const relocated=labelBank(rom)===0xaf;
  if(labelBank(rom)!==labelBank(original)&&!relocated)throw new Error('Banco de rótulos inválido.');
  for(let i=0;i<13;i++)if(rom[LABEL_TEMPLATE+i]!==([6,11].includes(i)&&relocated?0xaf:original[LABEL_TEMPLATE+i]))throw new Error('Cargador de rótulos inválido.');
  if(relocated){const script=loRom(0x828f21);for(let i=0;i<256;i++){const entry=Math.floor((i-2)/6),field=(i-2)%6;let expected=original[script+i];if(i>=2&&i<254&&field>=3){const p=0xdf00+entry*LABEL_SLOT;expected=field===3?p&255:field===4?p>>>8:0xaf;}if(rom[script+i]!==expected)throw new Error('Precarga de rótulos inválida.');}}
  for(let i=0;i<42;i++){
    const pointer=word(rom,LABEL_TABLE+i*2);
    if(pointer!==(relocated?0xdf00+i*LABEL_SLOT:word(original,LABEL_TABLE+i*2)))throw new Error('Puntero de rótulo inválido.');
    const offset=loRom(labelBank(rom)<<16|pointer);
    if(relocated&&(word(rom,offset)&0x7fff)>LABEL_SLOT)throw new Error('Rótulo fuera de su espacio reservado.');
    if(decompress(rom,offset).length!==64)throw new Error('Resolución del rótulo inválida.');
  }
}
export function smallLabelPatches(original,current,team,matrix){
  // Some legacy hacks keep 32 × 16 labels. Their native allocation and loader
  // must remain intact; the Studio's relocated 32 × 8 pool cannot hold them.
  const source=teamDataRom(original),native=smallLabelMatrix(source,teamExists(source,team)?team:activeTeamIds(source)[0]);
  if(native.length!==8){
    if(matrix.length!==native.length||matrix.some(row=>row.length!==32))throw new Error('Este hack usa rótulos de 32 × 16. Edita el dibujo en Gráficos conservando su resolución.');
    const offset=loRom(labelBank(current)<<16|teamPointer(current,LABEL_TABLE,team));
    const resource={id:`graphic:${offset}`,label:'Rótulo del equipo',offset,capacity:word(original,offset)&0x7fff,bpp:2,compressed:true,interleaved:!!(word(original,offset)&0x8000),decodedSize:encodeTiles(native,2).length};
    return [graphicPatch(original,resource,matrix)];
  }
  if(!Number.isInteger(team)||team<0||team>=teamCount(current)||matrix.length!==8||matrix.some(row=>row.length!==32))throw new Error('El rótulo debe medir 32 × 8.');
  if(!hasExtraTeams(current)&&Array.from({length:42},(_,i)=>smallLabelMatrix(original,i).length).some(height=>height!==8))throw new Error('Este hack mezcla resoluciones de rótulos; la reubicación no es compatible.');
  encodeTiles(matrix,2); // Validate every palette index before allocating.
  if(hasExtraTeams(current)){const encoded=compress(encodeTiles(matrix,2));if(encoded.length>LABEL_SLOT)throw new Error("El rótulo excede su espacio reservado.");const v3=hasExpandedTeams(current),offset=(v3?loRom(EXPANDED.labels):LABEL_POOL)+team*LABEL_SLOT,bytes=new Uint8Array(LABEL_SLOT).fill(255);bytes.set(encoded);return [{id:`${v3?"teams56":"teams"}:label:${team}`,offset,bytes,label:"Rótulo independiente"}];}
  const all=Array.from({length:42},(_,i)=>i===team?matrix:smallLabelMatrix(current,i));
  const pristine=all.every((m,i)=>JSON.stringify(m)===JSON.stringify(smallLabelMatrix(original,i)));
  const changes=LABEL_RULES.map(([id,offset,size])=>({id,offset,label:'Rótulos de equipo independientes',bytes:Uint8Array.from(original.subarray(offset,offset+size))}));
  if(!pristine){
    if(!((labelBank(original)===0x9a&&original.subarray(LABEL_POOL,LABEL_POOL+LABEL_POOL_SIZE).every(b=>b===255))||labelBank(original)===0xaf))throw new Error('No está libre el espacio verificado para los rótulos.');
    all.forEach((m,i)=>{const encoded=compress(encodeTiles(m,2)),pointer=0xdf00+i*LABEL_SLOT;if(encoded.length>LABEL_SLOT)throw new Error('El rótulo excede su espacio reservado.');changes[0].bytes.set(encoded,i*LABEL_SLOT);changes[1].bytes.set([pointer&255,pointer>>>8],i*2);});
    for(const i of [6,11])changes[2].bytes[i]=0xaf;
    for(let i=0;i<42;i++){const pointer=0xdf00+i*LABEL_SLOT;changes[3].bytes.set([pointer&255,pointer>>>8,0xaf],5+i*6);}
  }
  return changes;
}

export function flagPalettePatches(rom,team,colors){
  if(!Number.isInteger(team)||team<0||team>=teamCount(rom)||colors.length!==16)throw new Error('Paleta de bandera inválida.');
  const offset=teamPaletteOffset(rom,teamPointer(rom,0xe7d8,team))+2;
  if(JSON.stringify(colors.slice(12,16))===JSON.stringify(palette(rom,offset,4)))return [];
  for(let other=0;other<42;other++)if(other!==team){const start=teamPaletteOffset(rom,teamPointer(rom,0xe7d8,other))+2;if(start<offset+8&&offset<start+8)throw new Error('La paleta de esta bandera está compartida y requiere reubicación.');}
  return colors.slice(12,16).map((color,i)=>({id:`palette:${offset+i*2}`,offset:offset+i*2,label:'Paleta de bandera independiente',bytes:rgb555(color)}));
}


// CODE_85AD25 -> CODE_858E4C: DATA_87C54F uses abstract glyph IDs,
// translated through DATA_87C016. DATA_828EE0 loads the continent atlas
// at VRAM $4E00 (BG3 2bpp base $4000).
export function selectionGroupGraphics(rom,useNativeFont=false) {
  const offset=useNativeFont?loRom(0x9eec78):groupFontOffset(rom),data=decompress(rom,offset);
  const part={id:offset===GROUP_FONT_POOL?'groups:font':`graphic:${offset}`,offset,capacity:offset===GROUP_FONT_POOL?GROUP_FONT_CAPACITY:word(rom,offset)&0x7fff,bpp:2,columns:1,compressed:true,interleaved:!!(word(rom,offset)&0x8000),decodedSize:data.length};
  const strip=tiles(data,2,1),names=useNativeFont?['EUROPE 1','EUROPE 2','EUROPE 3','EUROPE 4','ASIA-AFRICA','N.S.AMERICA','ALL STARS']:readGroups(rom).map(g=>g.name);
  return names.map((name,index)=>{
    const map=loRom(0x870000|word(rom,loRom(0x87c54f)+(index%7)*2)),matrix=Array.from({length:16},()=>Array(64).fill(0)),owners=matrix.map(row=>row.map(()=>null));
    for(let i=0;i<16;i++){
      const glyph=rom[map+i];if(offset!==GROUP_FONT_POOL&&!glyph)continue;
      const tile=offset===GROUP_FONT_POOL?index*16+i:(word(rom,loRom(0x87c016)+glyph*2)&1023)-448;
      if(tile<0||tile>=data.length/16){if(hasCustomGroups(rom)&&!useNativeFont)continue;throw new Error('Tile de grupo fuera de la fuente de selección.');}
      for(let y=0;y<8;y++)for(let x=0;x<8;x++){
        const px=i%8*8+x,py=(i>>3)*8+y,sy=tile*8+y;
        matrix[py][px]=strip[sy][x];owners[py][px]={part:0,x,y:sy};
      }
    }
    return {id:`selection-group:${index}`,kind:'group-label',label:name,shared:true,bpp:2,columns:8,capacity:GROUP_FONT_CAPACITY,parts:[part],matrix,owners,editable:owners.map(row=>row.map(Boolean)),colors:['transparent',...palette(rom,loRom(0x89e460)+2,3)]};
  });
}


// Each title has sixteen independent 2bpp tiles. The selection-only renderer
// writes these tiles to the original BG3 mirror and uses the game's DMA queue.
// Storage is inside FREE_BYTES $AEE4EA..$AEFFFF, separate from bank $AF assets.
export const GROUP_FONT_POOL=loRom(0xaeea00),GROUP_FONT_CAPACITY=1850;
export const GROUP_FONT_LOADER=loRom(0x828ee0)+14;
const GROUP_RENDERER=loRom(0xaef200),GROUP_RENDER_HOOK=loRom(0x85ad3a);
export const GROUP_RULES=[['groups:font',GROUP_FONT_POOL,GROUP_FONT_CAPACITY],['groups:loader',GROUP_FONT_LOADER,3],['groups:renderer',GROUP_RENDERER,128],['groups:render-hook',GROUP_RENDER_HOOK,4]];
function groupFontOffset(rom){return loRom(word(rom,GROUP_FONT_LOADER)|(rom[GROUP_FONT_LOADER+2]<<16));}
function groupRenderer(rom){
 const code=[];const emit=(...bytes)=>code.push(...bytes);
 emit(0x0b,0xa5,0x42);if(hasCustomGroups(rom))emit(0x0a,0xaa,0xbf,groupPageTitles(rom)&255,(groupPageTitles(rom)>>>8)&255,groupPageTitles(rom)>>>16);emit(0x0a,0x0a,0x0a,0x0a,0x18,0x69,0xc0,0x21,0x48,0xa9,0,0,0x5b,0x68,0xa2,0x0c,0xe4);
 const row=()=>{emit(0xa0,8,0);emit(0x9f,0,0,0x7f,0x1a,0xe8,0xe8,0x88,0xd0,0xf6);};
 row();emit(0x48,0x8a,0x18,0x69,0x30,0,0xaa,0x68);row();
 emit(0xad,6,0x14,0x89,0,1,0xd0,0);const skip=code.length-1;
 emit(0xa9,0x7f,0,0x85,0,0xad,0xb0,0x1e,0x29,0xfc,0,0xeb,0x18,0x69,6,2,0xa8,0xa2,0x80,0,0xa9,0x0c,0xe4,0x22,0x37,0x8e,0x80);
 code[skip]=code.length-skip-1;emit(0x2b,0x6b);
 const bytes=new Uint8Array(128).fill(0xea);bytes.set(code);return bytes;
}
export function validateGroupStorage(rom,original){
 const offset=groupFontOffset(rom),relocated=offset===GROUP_FONT_POOL;
 if(offset!==groupFontOffset(original)&&!relocated)throw new Error('Fuente de grupos no compatible.');
 if(decompress(rom,offset).length!==(relocated?Math.max(7,readGroups(rom).length)*256:992))throw new Error('Resolución de títulos de grupos inválida.');
 if(relocated&&(word(rom,offset)&0x7fff)>GROUP_FONT_CAPACITY)throw new Error('Fuente de grupos fuera del espacio reservado.');
 const hook=relocated?Uint8Array.of(0x22,0,0xf2,0xae):original.slice(GROUP_RENDER_HOOK,GROUP_RENDER_HOOK+4);
 const renderer=relocated?groupRenderer(rom):original.slice(GROUP_RENDERER,GROUP_RENDERER+128);
 if(hook.some((b,i)=>b!==rom[GROUP_RENDER_HOOK+i])||renderer.some((b,i)=>b!==rom[GROUP_RENDERER+i]))throw new Error('Renderizador de grupos no compatible.');
}
function groupLabelPatches(original,current,resource,matrix){
 if(matrix.length!==16||matrix.some(row=>row.length!==64))throw new Error('La resolución debe conservarse.');
 encodeTiles(matrix,2);
 const index=Number(resource.id.split(':')[1]),all=selectionGroupGraphics(current).map((r,i)=>i===index?matrix:r.matrix),baseline=selectionGroupGraphics(original);
 const patches=GROUP_RULES.map(([id,offset,size])=>({id,offset,label:resource.label,bytes:original.slice(offset,offset+size)}));
 if(!hasCustomGroups(current)&&all.length===baseline.length&&all.every((m,i)=>JSON.stringify(m)===JSON.stringify(baseline[i].matrix)))return patches;
 if(groupFontOffset(original)!==GROUP_FONT_POOL){
  if(![0x22,0xa4,0x8d,0x85].every((b,i)=>original[GROUP_RENDER_HOOK+i]===b))throw new Error('Renderizador de grupos no compatible.');
  for(const rule of [GROUP_RULES[0],GROUP_RULES[2]])if(original.slice(rule[1],rule[1]+rule[2]).some(b=>b!==255))throw new Error('El espacio reservado para los grupos está ocupado.');
 }
 const data=new Uint8Array(Math.max(7,all.length)*256);all.forEach((m,i)=>data.set(encodeTiles(m,2),i*256));
 const encoded=compress(data,false);if(encoded.length>GROUP_FONT_CAPACITY)throw new Error('Fuente de grupos fuera del espacio reservado.');
 patches[0].bytes.fill(255);patches[0].bytes.set(encoded);
 patches[1].bytes=Uint8Array.of(0,0xea,0xae);patches[2].bytes=groupRenderer(current);patches[3].bytes=Uint8Array.of(0x22,0,0xf2,0xae);
 return patches;
}
