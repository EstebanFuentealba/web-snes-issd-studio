import {hasExtraTeams,hasPhysicalTeams,COMPACT_GLYPH_ATLAS,COMPACT_GLYPH_ATLAS_SIZE,TEAM_METADATA,EXTRA_BIG_LABEL_ADDRESS,EXTRA_BIG_LABEL_CAPACITY} from './team-count.mjs';
import {decompress,loRom,word,tiles,palette} from './binary.mjs';
import {compress,encodeTiles,graphicResources,graphicPatches,smallLabelPatches,smallLabelMatrix} from './graphics.mjs';
// COD_BigTeamAndStadiumNames, 42 frames / 411 sprites, loaded at $7E4F02.
// Each frame is a list of x/y/tile/attributes in four separate planes.
export const BIG_LABEL_ADDRESS=0x98a526;
export const BIG_LABEL_ID=`team-labels:${loRom(BIG_LABEL_ADDRESS)}`;
// Frame identities verified from the rendered glyphs (e.g. frame 14 = ITALY).
export const TEAM_LABEL_FRAMES=[14,15,16,0,2,3,4,6,12,5,8,10,7,11,9,13,1,36,18,20,21,22,28,32,19,17,33,24,23,25,34,29,30,27,26,31,35,38,41,39,40,37];
// USA cartridge letter capacities, verified from native glyphs and their frames.
// Keep a slot's limit after saving/reopening a ROM with a shorter replacement.
const TEAM_LABEL_CAPACITIES=[5,7,7,6,5,7,8,7,7,6,7,6,7,8,6,5,6,7,7,5,8,10,14,6,5,7,6,7,8,7,6,9,8,6,3,7,8,11,11,10,12,18];
export function labelLayout(rom,expanded=false) {
  const data=decompress(rom,loRom(hasExtraTeams(rom)?EXTRA_BIG_LABEL_ADDRESS:BIG_LABEL_ADDRESS)),count=data[0],sprites=word(data,1),base=3+count;
  if(!([42,48].includes(count))||sprites!==(count===48?531:411)||data.length!==base+sprites*4)throw new Error('Formato de nombres grandes no compatible.');
  if(expanded&&count===42)return extendedLabelLayout({data,sprites,base});
  return {data,sprites,base};
}
export function extendedLabelLayout(layout){
 const data=new Uint8Array(3+48+531*4);data.set([48,19,2]);data.set(layout.data.slice(3,45),3);data.fill(20,45,51);
 const f=labelFrame(layout,0);
 for(let p=0;p<4;p++){data.set(layout.data.slice(layout.base+p*411,layout.base+(p+1)*411),51+p*531);for(let t=0;t<6;t++)for(let i=0;i<20;i++)data[51+p*531+411+t*20+i]=i<f.count?layout.data[layout.base+p*411+f.start+i]:[0,4,170,10][p];}
 return {data,sprites:531,base:51};
}
export function labelFrame(layout,team) {
  const frame=team>=42&&team<48?team:TEAM_LABEL_FRAMES[team];if(frame===undefined)throw new Error('Equipo inválido.');
  let start=0;for(let i=0;i<frame;i++)start+=layout.data[3+i];
  return {frame,start,count:layout.data[3+frame]};
}
export function bigLabel(rom,team) {
  const layout=labelLayout(rom,team>=42),frame=labelFrame(layout,team),font=menuFont(rom);
  const matrix=Array.from({length:24},()=>new Array(80).fill(0));
  for(let i=0;i<frame.count;i++) {
    const p=layout.base+frame.start+i,id=layout.data[p+layout.sprites*2],attr=layout.data[p+layout.sprites*3],size=attr&16?16:8,x0=layout.data[p]-(size===16?4:0),y0=layout.data[p+layout.sprites]-(size===16?4:0);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
      const tile=id+((attr&1)<<8)+Math.floor(x/8)+Math.floor(y/8)*16;
      if(tile<0||tile>=512||x0+x<0||y0+y<0||x0+x>=80||y0+y>=24)continue;
      const pixel=font[Math.floor(tile/16)*8+y%8][tile%16*8+x%8];
      if(pixel)matrix[y0+y][x0+x]=pixel;
    }
  }
  const colors=new Array(16).fill('transparent');colors.splice(1,11,...palette(rom,loRom(0x89e362),11));
  return {matrix,colors,maxLetters:TEAM_LABEL_CAPACITIES[team]||10};
}
export function validateLabelLayout(bytes,original) {
  let source=original;if(bytes[0]===42&&hasExtraTeams(original)){source=original.slice();source.fill(255,TEAM_METADATA,TEAM_METADATA+4);}
  const baseline=labelLayout(source,bytes[0]===48),n=baseline.sprites,base=baseline.base;
  if(bytes.length!==baseline.data.length||bytes.slice(0,base).some((b,i)=>b!==baseline.data[i]))throw new Error('No se puede cambiar la cantidad de sprites de los nombres grandes.');
  for(let i=base;i<bytes.length;i++) if(bytes[i]!==baseline.data[i]) {
    const index=(i-base)%n,x=bytes[base+index],y=bytes[base+n+index],tile=bytes[base+n*2+index],attr=bytes[base+n*3+index];
    const glyph=(tile>=128&&tile<=159)||(tile>=160&&tile<=185)||tile===170||tile===186;
    const czech=labelFrame(baseline,22),nativeCzech=index>=czech.start&&index<czech.start+czech.count&&(attr===11&&[4,12].includes(y)&&[223,239].includes(tile)||attr===27&&y===8&&[217,219,221].includes(tile));
    if(x>76||!(attr===10&&[4,12].includes(y)&&glyph||attr===26&&y===8&&packedGlyphs(original).some(p=>p.tile===tile)||nativeCzech))throw new Error('Sprite de nombre grande inválido.');
  }
}
function planTeamName(name,pairs,count){
  const plans=Array(name.length+1);plans[name.length]={cost:0,parts:[]};
  for(let i=name.length-1;i>=0;i--){plans[i]={cost:(name[i]===' '?0:name[i]==='.'?1:2)+plans[i+1].cost,parts:[{text:name[i],tile:tileFor(name[i]),x:i},...plans[i+1].parts]};if(name.length*2>count&&i+1<name.length){const pair=pairs.find(p=>p.text===name.slice(i,i+2));if(pair&&1+plans[i+2].cost<plans[i].cost)plans[i]={cost:1+plans[i+2].cost,parts:[{...pair,x:i},...plans[i+2].parts]};}}
  return plans[0];
}
export function compatibleTeamLabelSlot(original,current,teams,name){
  const layout=labelLayout(current),pairs=packedGlyphs(original);
  return teams.find(team=>name.length<=(TEAM_LABEL_CAPACITIES[team]||10)&&planTeamName(name,pairs,labelFrame(layout,team).count).cost<=labelFrame(layout,team).count);
}
export function bigTeamNamePatches(original,current,team,name) {
  name=name.trim().toUpperCase();
  const layout=labelLayout(current),frame=labelFrame(layout,team),max=bigLabel(original,team).maxLetters;
  if(!/^[A-Z][A-Z .]*$/.test(name)||name.length>max)throw new Error(`Este slot admite hasta ${max} caracteres A–Z, puntos y espacios.`);
  const currentText=teamNameTexts(original,current,team).large,nativeCzech=team===22&&hasCzechGlyphs(layout,frame)&&/^(THE )?CZECH REP\.?$/.test(name);
  const pairs=packedGlyphs(original);
  const plan=planTeamName(name,pairs,frame.count);
  if(name!==currentText&&!nativeCzech&&plan.cost>frame.count)throw new Error(`El nombre admite ${max} caracteres, pero esta combinación requiere ${plan.cost} sprites y el slot dispone de ${frame.count}. Prueba una combinación con letras emparejadas del juego.`);
  const positions=[];let width=0;
  for(const c of name){positions.push(width);width+=c==='.'||c===' '?4:8;}
  const nativeLeft=Math.min(...Array.from({length:frame.count},(_,i)=>{const p=layout.base+frame.start+i;return layout.data[p]-(layout.data[p+layout.sprites*3]&16?4:0);}));
  // Added frames contain transparent padding at x=0. It is not a text
  // anchor: center their text in the native 80-pixel name area instead.
  const left=team>=42||!currentText?Math.max(0,Math.floor((80-width)/2)):Math.max(0,Math.min(nativeLeft,80-width));
  const sprites=plan.parts.slice().reverse().flatMap(part=>part.text===' '?[]:part.text.length===2?[[left+positions[part.x]+4,8,part.tile,26]]:part.text==='.'?[[left+positions[part.x],12,186,10]]:[[left+positions[part.x],12,part.tile+16,10],[left+positions[part.x],4,part.tile,10]]);
  while(sprites.length<frame.count)sprites.push([left,4,170,10]);
  // Reuse native positions and paired glyphs whenever the new text fits the
  // same grouping. This preserves kerning and the compressed byte budget.
  const groups=[];
  // Transparent padding is not a letter group: it can share the first glyph's
  // x position and must never acquire a visible tile during a rename.
  for(let i=0;i<frame.count;i++){const p=layout.base+frame.start+i,tile=layout.data[p+layout.sprites*2],large=!!(layout.data[p+layout.sprites*3]&16);if(large||Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ',c=>tileFor(c)).includes(tile))groups.push({x:layout.data[p]-(large?4:0),large,i});}
  groups.sort((a,b)=>a.x-b.x);let cursor=0;const assignments=new Map();
  for(const group of groups){while(name[cursor]===' ')cursor++;const text=name.slice(cursor,cursor+(group.large?2:1));if(group.large){const pair=pairs.find(p=>p.text===text);if(!pair){assignments.clear();break;}assignments.set(group.x,{tile:pair.tile,large:true});}else assignments.set(group.x,{tile:tileFor(text||' '),large:false});cursor+=group.large?2:1;}
  // Reusing coordinates is safe only when word boundaries stay in place.
  const wordBreaks=text=>Array.from(text,(_,i)=>text[i]===' '?i:-1).filter(i=>i>=0).join(',');
  if(wordBreaks(name)!==wordBreaks(currentText)||new Set(groups.map(group=>group.x)).size!==groups.length)assignments.clear();
  if(!currentText||team>=42||name.includes('.')||Array.from({length:frame.count},(_,i)=>layout.data[layout.base+frame.start+i+layout.sprites*2]).includes(186)||Array.from({length:frame.count},(_,i)=>layout.data[layout.base+frame.start+i+layout.sprites*3]).some(a=>a&1))assignments.clear();
  if(nativeCzech&&name!==currentText){
    // CZECH REP. spans tile boundaries in the condensed menu font. Replace
    // the separate THE sprite with a duplicate at an existing glyph's position.
    // The duplicate draws identical pixels and preserves the 753-byte budget.
    const source=layout.base+frame.start+4;
    for(let i=0;i<frame.count;i++){
      const p=layout.base+frame.start+i;
      if(i===5)for(let plane=0;plane<4;plane++)layout.data[p+plane*layout.sprites]=name.startsWith('THE ')?labelLayout(original).data[p+plane*layout.sprites]:layout.data[source+plane*layout.sprites];
    }
  }else if(name!==currentText||team>=42){
    if(assignments.size&&cursor>=name.length)for(let i=0;i<frame.count;i++){const p=layout.base+frame.start+i;if(layout.data[p+layout.sprites*2]===170)continue;const large=!!(layout.data[p+layout.sprites*3]&16),entry=assignments.get(layout.data[p]-(large?4:0));layout.data[p+layout.sprites*2]=entry.tile===170?170:entry.tile+(!large&&layout.data[p+layout.sprites]===12?16:0);}
    else for(let i=0;i<frame.count;i++)for(let plane=0;plane<4;plane++)layout.data[layout.base+frame.start+i+layout.sprites*plane]=sprites[i][plane];
  }
  const offset=loRom(hasExtraTeams(current)?EXTRA_BIG_LABEL_ADDRESS:BIG_LABEL_ADDRESS),capacity=hasExtraTeams(current)?EXTRA_BIG_LABEL_CAPACITY:word(original,offset)&0x7fff;
  validateLabelLayout(layout.data,original);
  canonicalizeLabelFrames(layout,labelLayout(original,hasExtraTeams(current)));
  const encoded=compressLabelLayout(layout,capacity),bytes=hasExtraTeams(current)?new Uint8Array(capacity).fill(255):Uint8Array.from(original.subarray(offset,offset+capacity));
  validateLabelLayout(layout.data,original);
  if(encoded.length>capacity)throw new Error(`Los nombres grandes requieren ${encoded.length} bytes; hay ${capacity}. Prueba otro nombre.`);
  bytes.set(encoded);
  return [...(nativeCzech?czechPunctuationPatches(original,current,name.endsWith('.')):[]),{id:hasExtraTeams(current)?"teams:big-labels":BIG_LABEL_ID,offset,label:`Nombre grande de selección · ${name}`,bytes}];
}
export function smallTeamNamePatches(original,current,team,name){
  name=name.trim().toUpperCase();
  if(!/^[A-Z][A-Z .]*$/.test(name))throw new Error('Usa letras A–Z, puntos y espacios.');
  return smallLabelPatches(original,current,team,compactTeamName(original,name));
}
export function renameTeamPatches(original,current,team,name){
  const big=bigTeamNamePatches(original,current,team,name);
  return [...smallTeamNamePatches(original,current,team,name),...big];
}
export function restoreTeamLabelPatches(original,current,team) {
  const layout=labelLayout(current),baseline=labelLayout(original,hasExtraTeams(current)),frame=labelFrame(layout,team);
  for(let p=0;p<4;p++)for(let i=0;i<frame.count;i++){const offset=layout.base+p*layout.sprites+frame.start+i;layout.data[offset]=baseline.data[offset];}
  const offset=loRom(hasExtraTeams(current)?EXTRA_BIG_LABEL_ADDRESS:BIG_LABEL_ADDRESS),capacity=hasExtraTeams(current)?EXTRA_BIG_LABEL_CAPACITY:word(original,offset)&0x7fff,bytes=hasExtraTeams(current)?new Uint8Array(capacity).fill(255):Uint8Array.from(original.subarray(offset,offset+capacity));
  canonicalizeLabelFrames(layout,baseline);
  if(layout.data.some((b,i)=>b!==baseline.data[i])){const encoded=compressLabelLayout(layout,capacity);if(encoded.length>capacity)throw new Error('La restauración parcial supera el espacio del bloque de nombres.');bytes.set(encoded);}
  return [...(team===22?czechPunctuationPatches(original,current,true):[]),...smallLabelPatches(original,current,team,smallLabelMatrix(original,team)),{id:hasExtraTeams(current)?"teams:big-labels":BIG_LABEL_ID,offset,bytes,label:'Restaurar nombre grande del equipo'}];
}

// Sprite order affects compression. Reorder only disjoint rectangles so OAM
// priority and every rendered pixel stay unchanged, including other teams.
function frameSprites(layout,frame){
  return Array.from({length:frame.count},(_,i)=>Array.from({length:4},(_,p)=>layout.data[layout.base+frame.start+i+p*layout.sprites]));
}
function writeFrameSprites(layout,frame,sprites){
  sprites.forEach((sprite,i)=>sprite.forEach((v,p)=>{layout.data[layout.base+frame.start+i+p*layout.sprites]=v;}));
}
function spritesOverlap(a,b){
  const size=s=>s[3]&16?16:8,sa=size(a),sb=size(b),ax=a[0]-(sa===16?4:0),ay=a[1]-(sa===16?4:0),bx=b[0]-(sb===16?4:0),by=b[1]-(sb===16?4:0);
  return ax<bx+sb&&bx<ax+sa&&ay<by+sb&&by<ay+sa;
}
function preservesSpritePriority(sprites,order){
  return !order.some((a,i)=>order.slice(i+1).some(b=>a>b&&spritesOverlap(sprites[a],sprites[b])));
}
function canonicalizeLabelFrames(layout,baseline){
  for(let team=0;team<36;team++){
    const frame=labelFrame(layout,team),sprites=frameSprites(layout,frame),native=frameSprites(baseline,frame),used=new Set();
    const order=native.map(sprite=>{const i=sprites.findIndex((other,i)=>!used.has(i)&&other.every((v,p)=>v===sprite[p]));used.add(i);return i;});
    if(order.every(i=>i>=0)&&preservesSpritePriority(sprites,order))writeFrameSprites(layout,frame,native);
  }
}
function compressLabelLayout(layout,capacity){
  let encoded=compress(layout.data);
  if(encoded.length<=capacity)return encoded;
  for(let team=0;team<36;team++){
    const frame=labelFrame(layout,team),sprites=frameSprites(layout,frame);let best=sprites;
    // Bank-1 Czech glyphs have index-specific validation and stay in place.
    if(sprites.some(s=>s[3]!==10&&s[3]!==26))continue;
    for(let plane=0;plane<4;plane++)for(const direction of [-1,1]){
      const order=sprites.map((_,i)=>i).sort((a,b)=>direction*(sprites[a][plane]-sprites[b][plane]));
      if(!preservesSpritePriority(sprites,order))continue;
      const candidate=order.map(i=>sprites[i]);writeFrameSprites(layout,frame,candidate);
      const bytes=compress(layout.data);
      if(bytes.length<encoded.length){encoded=bytes;best=candidate;}
    }
    writeFrameSprites(layout,frame,best);
    if(encoded.length<=capacity)return encoded;
  }
  return encoded;
}
export function labelLayoutPatch(original,layout,expanded=false){
 const offset=loRom(expanded?EXTRA_BIG_LABEL_ADDRESS:BIG_LABEL_ADDRESS),capacity=expanded?EXTRA_BIG_LABEL_CAPACITY:word(original,offset)&0x7fff;
 validateLabelLayout(layout.data,original);
 const encoded=compressLabelLayout(layout,capacity),bytes=new Uint8Array(capacity).fill(255);
 if(encoded.length>capacity)throw new Error('Los nombres grandes exceden el espacio disponible.');
 bytes.set(encoded);return {id:expanded?'teams:big-labels':BIG_LABEL_ID,offset,bytes,label:'Reorganizar nombres de equipos'};
}

// Native compact glyphs, cropped from immutable country rasters. In particular,
// preserve gray edge pixels rather than subsampling the unrelated red font.
const COMPACT_GLYPHS={A:[1,18,3],B:[30,6,3],C:[9,21,3],D:[1,26,3],E:[2,2,3],F:[9,5,3],G:[2,10,3],H:[1,2,3],I:[0,8,1],J:[24,5,4],K:[25,9,3],L:[1,10,3],M:[7,14,3],N:[1,22,3],O:[1,6,3],P:[6,1,3],Q:[1,6,3],R:[9,9,3],S:[11,3,3],T:[0,10,3],U:[6,17,3],V:[6,17,3],W:[3,15,5],X:[33,13,3],Y:[0,21,3],Z:[30,18,3]};
function compactGlyph(original,c){
    if(c===' ')return Array.from({length:7},()=>[0]);
    if(c==='.')return Array.from({length:7},(_,y)=>[y===6?1:0]);
    if(hasPhysicalTeams(original)){
      const offset=loRom(COMPACT_GLYPH_ATLAS)+(c.charCodeAt(0)-65)*10,width=original[offset];
      if(width<1||width>5)throw new Error('Fuente de nombres pequeños inválida.');
      return Array.from({length:7},(_,y)=>Array.from({length:width},(_,x)=>original[offset+1+((y*5+x)>>>2)]>>>((y*5+x)%4*2)&3));
    }
    const source=COMPACT_GLYPHS[c];
    const [team,x,width]=source,glyph=smallLabelMatrix(original,team).slice(0,7).map(row=>row.slice(x,x+width).map(p=>p===3?0:p));
    // Q and V are absent from country names. Adapt O/U strokes at this tiny
    // resolution instead of reducing the wide italic Layer 3 character set.
    if(c==='Q'){glyph[5][1]=1;glyph[6][2]=1;}
    if(c==='V'){glyph[5]=[1,0,1];glyph[6]=[0,1,0];}
    return glyph;
}
export function compactGlyphAtlas(original){
 if(hasPhysicalTeams(original))return original.slice(loRom(COMPACT_GLYPH_ATLAS),loRom(COMPACT_GLYPH_ATLAS)+COMPACT_GLYPH_ATLAS_SIZE);
 // Read the immutable native country rasters even when the user has already
 // relocated and renamed their visible small labels.
 const source=original.slice(),pointers=[0xaad1,0xac13,0xaf6a,0xacc1,0xaefc,0xaba5,0xb199,0xad34,0xabda,0xac87,0xab6a,0xacfc,0xaaf7,0xb012,0xac4b,0xb24f,0xb213,0xb2cd,0xb161,0xae86,0xb28f,0xb0ba,0xb12d,0xb1d9,0xafdc,0xada3,0xb087,0xab31,0xae10,0xb04b,0xaec8,0xafa5,0xae4d,0xad6b,0xaddc,0xb0f5];
 source.fill(255,TEAM_METADATA,TEAM_METADATA+4);source[0xe6b4+6]=0x9a;pointers.forEach((n,i)=>source.set([n&255,n>>>8],0xe6c1+i*2));
 const bytes=new Uint8Array(COMPACT_GLYPH_ATLAS_SIZE);
 Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ').forEach((c,i)=>{const glyph=compactGlyph(source,c);bytes[i*10]=glyph[0].length;glyph.forEach((row,y)=>row.forEach((p,x)=>bytes[i*10+1+((y*5+x)>>>2)]|=p<<((y*5+x)%4*2)));});
 return bytes;
}
export function compactTeamName(original,name){
  const glyphs=Array.from(name,c=>compactGlyph(original,c));
  let width=glyphs.reduce((n,g)=>n+g[0].length,0)+glyphs.length-1;
  const gaps=Array(Math.max(0,glyphs.length-1)).fill(1);
  for(let i=0;i<gaps.length&&width>32;i++)if('I .'.includes(name[i])||'I .'.includes(name[i+1])){gaps[i]=0;width--;}
  if(width>32)throw new Error('El nombre no cabe en el rótulo pequeño de 32 píxeles.');
  const result=Array.from({length:8},()=>Array(32).fill(0));let x=Math.floor((32-width)/2);
  glyphs.forEach((glyph,index)=>{glyph.forEach((row,y)=>row.forEach((p,i)=>result[y][x+i]=p));x+=glyph[0].length+(gaps[index]||0);});
  return result;
}

// Menu DMA uploads: VRAM $6800 is tile 128, $7D00 is tile 464.
// OAM attribute bit 0 selects the second 256-tile bank.
function menuFont(rom){
  const bytes=new Uint8Array(512*32);
  bytes.set(decompress(rom,loRom(0x9de13c)),128*32);
  bytes.set(decompress(rom,loRom(0x9ba400)),464*32);
  return tiles(bytes,4,16);
}
const tileFor=c=>c==='.'?186:c===' '?170:(c.charCodeAt(0)-65<16?128+c.charCodeAt(0)-65:160+c.charCodeAt(0)-65-16);
function packedGlyphs(rom){
  const font=tiles(decompress(rom,loRom(0x9de13c)),4,16);
  const glyph=id=>Array.from({length:16},(_,y)=>Array.from({length:8},(_,x)=>{const t=id+Math.floor(y/8)*16-128;return t>=0&&t<128?font[Math.floor(t/16)*8+y%8][t%16*8+x]:-1;})).flat().join(',');
  const chars=new Map(Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ',c=>[glyph(tileFor(c)),c])),pairs=[];
  for(let tile=128;tile<=238;tile++){if(tile%16===15)continue;const a=chars.get(glyph(tile)),b=chars.get(glyph(tile+1));if(a&&b)pairs.push({tile,text:a+b});}
  return pairs;
}
export function frameText(rom,team){
  const layout=labelLayout(rom,team>=42),frame=labelFrame(layout,team),pairs=packedGlyphs(rom),letters=[];
  if(team===22&&hasCzechGlyphs(layout,frame))return (Array.from({length:frame.count},(_,i)=>layout.data[layout.base+frame.start+i+layout.sprites*2]).includes(234)?'THE ':'')+'CZECH REP'+(tiles(decompress(rom,loRom(0x9ba400)),4,16).slice(11,14).some(row=>row.slice(120,123).some(Boolean))?'.':'');
  for(let i=0;i<frame.count;i++){const p=layout.base+frame.start+i,tile=layout.data[p+layout.sprites*2],attr=layout.data[p+layout.sprites*3];if(attr&1)return null;if(tile===186){letters.push({x:layout.data[p],text:'.'});continue;}if(attr&16){const pair=pairs.find(pair=>pair.tile===tile);if(!pair)return null;letters.push({x:layout.data[p]-4,text:pair.text});}else {const c=Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ ',c=>({c,tile:tileFor(c)})).find(c=>c.tile===tile);if(c)letters.push({x:layout.data[p],text:c.c});}}
  // Spaces have no visible sprite. Recover them from coordinates in native
  // and added slots alike, ignoring transparent capacity padding.
  const ordered=letters.filter(l=>l.text!==' ').sort((a,b)=>a.x-b.x);
  return ordered.map((letter,i)=>{const next=ordered[i+1],width=letter.text==='.'?4:letter.text.length*8,distance=next?next.x-letter.x-width:0,gap=Math.max(0,Math.floor(distance/4));return letter.text+' '.repeat(gap||(team<42&&letter.text==='.'&&distance>=3?1:0));}).join('').trim();
}

function hasCzechGlyphs(layout,frame){
  const ids=[];
  for(let i=0;i<frame.count;i++){const p=layout.base+frame.start+i;if(layout.data[p+layout.sprites*3]&1)ids.push(layout.data[p+layout.sprites*2]);}
  return [217,219,221,223,239].every(tile=>ids.includes(tile));
}

const SMALL_NAMES=['ITALY','HOLLAND','ENGLAND','NORWAY','SPAIN','IRELAND','PORTUGAL','DENMARK','GERMANY','FRANCE','BELGIUM','SWEDEN','ROMANIA','BULGARIA','RUSSIA','SWISS','GREECE','CROATIA','AUSTRIA','WALES','SCOTLAND','N.IRELAND','CZECH','POLAND','JAPAN','S.KOREA','TURKEY','NIGERIA','CAMEROON','MOROCCO','BRAZIL','ARGENTINA','COLOMBIA','MEXICO','U.S.A.','URUGUAY','ALLSTAR','E.STAR.A','E.STAR.B','ASIANSTAR','A.STAR','ALLA.STAR'];
const STAR_BIG_NAMES=['ALL STAR','EUROSTAR.A','EUROSTAR.B','ASIAN STAR','AFRICAN STAR','ALL AMERICAN STAR'];
export function teamNameTexts(original,current,team){
  const small=smallLabelMatrix(current,team),baseline=smallLabelMatrix(original,team);
  let a,b,frame;
  try{a=labelLayout(original,hasExtraTeams(current));b=labelLayout(current);frame=labelFrame(a,team);}catch{return {small:small.length===8&&JSON.stringify(small)===JSON.stringify(baseline)?SMALL_NAMES[team]||'':'',large:''};}
  const sameFrame=Array.from({length:4},(_,p)=>p).every(p=>Array.from({length:frame.count},(_,i)=>a.data[a.base+frame.start+i+p*a.sprites]).every((v,i)=>v===b.data[b.base+frame.start+i+p*b.sprites]));
  return {small:team<42&&JSON.stringify(small)===JSON.stringify(baseline)?SMALL_NAMES[team]:decodeCompactName(original,small),large:sameFrame&&team>=36&&team<42?STAR_BIG_NAMES[team-36]:frameText(current,team)||''};
}
function decodeCompactName(original,matrix){
  const glyphs=Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ.',text=>{
    const m=compactTeamName(original,text);const xs=m.flatMap(row=>row.flatMap((p,x)=>p?[x]:[]));const left=Math.min(...xs),right=Math.max(...xs);
    return {text,matrix:m.slice(0,7).map(row=>row.slice(left,right+1))};
  }).filter(g=>g.matrix[0].length>0);
  const xs=matrix.flatMap(row=>row.flatMap((p,x)=>p&&p!==3?[x]:[]));if(!xs.length)return '';
  const left=Math.min(...xs),end=Math.max(...xs)+1,memo=new Map();
  const read=x=>{
    if(x>=end)return '';if(memo.has(x))return memo.get(x);
    let best=null;
    for(const glyph of glyphs){const width=glyph.matrix[0].length;if(x+width>end)continue;
      if(!glyph.matrix.every((row,y)=>row.every((p,i)=>p===(matrix[y][x+i]===3?0:matrix[y][x+i]))))continue;
      let next=x+width,gap=0;while(next<end&&matrix.slice(0,7).every(row=>!row[next]||row[next]===3)){next++;gap++;}
      const rest=read(next);if(rest!==null){const result=glyph.text+(gap>=2&&rest?' ':'')+rest;if(best===null||result.length<best.length)best=result;}
    }
    memo.set(x,best);return best;
  };
  return read(left)||'';
}
export function previewBigTeamText(rom,name){
  const font=menuFont(rom),colors=bigLabel(rom,0).colors;
  const width=Array.from(name).reduce((n,c)=>n+(c==='.'||c===' '?4:8),0),matrix=Array.from({length:24},()=>Array(Math.max(80,width)).fill(0));let left=Math.max(0,Math.floor((80-width)/2));
  for(const c of name){if(c===' '){left+=4;continue;}if(!/[A-Z.]/.test(c))continue;
    const tile=tileFor(c),start=c==='.'?8:0;
    for(let y=start;y<16;y++)for(let x=0;x<(c==='.'?4:8);x++){const id=tile+(c==='.'?0:Math.floor(y/8)*16);matrix[y+4][left+x]=font[Math.floor(id/16)*8+y%8][id%16*8+x];}
    left+=c==='.'?4:8;
  }
  return {matrix,colors};
}

// Only Czech's period occupies these pixels; the American title uses tiles 0–24.
export const CZECH_FONT_ADDRESS=0x9ba400;
function czechPunctuationPatches(original,current,period){
  const offset=loRom(CZECH_FONT_ADDRESS),capacity=word(original,offset)&0x7fff;
  const native=tiles(decompress(original,offset),4,16),matrix=tiles(decompress(current,offset),4,16);
  for(let y=11;y<14;y++)for(let x=120;x<123;x++)matrix[y][x]=period?native[y][x]:0;
  const decoded=encodeTiles(matrix,4),baseline=decompress(original,offset);
  const bytes=original.slice(offset,offset+capacity);
  if(decoded.some((b,i)=>b!==baseline[i])){const encoded=compress(decoded,!!(word(original,offset)&0x8000));if(encoded.length>capacity)throw new Error('El punto del nombre excede el espacio de su fuente.');bytes.set(encoded);}
  return [{id:`czech-font:${offset}`,offset,bytes,label:'Puntuación del nombre rojo de Czech Rep.'}];
}
export function validateCzechFont(bytes,original){
  const matrix=tiles(decompress(bytes,0),4,16),native=tiles(decompress(original,loRom(CZECH_FONT_ADDRESS)),4,16);
  if(matrix.length!==native.length||matrix.some((row,y)=>row.some((p,x)=>!(y>=11&&y<14&&x>=120&&x<123)&&p!==native[y][x])))throw new Error('Solo se puede cambiar la puntuación de Czech Rep.');
}
