import {externalDeluxeLayout} from './external-layout.mjs';
import {stadiumAssetAddress} from './wc26-stadiums.mjs';
import {word,loRom,decompress,tiles,palette} from './binary.mjs';
import {compress} from './compression.mjs';
import {encodeTiles} from './encode-tiles.mjs';
import {rgb555} from './graphics.mjs';
import {STADIUM_ASSETS,STADIUM_PALETTES} from './stadium-catalog.mjs';
import {hasExtraTeams} from './team-count.mjs';

// DATA_87CA9B (7 glyphs), DATA_82FAED (display yards), DATA_81EC47
// (match coordinates). CODE_A4A046 originally reuses a team's OAM frame.
export const STADIUM_COUNT=8;
export const STADIUM_NAME_BASE=0x3ca9b,STADIUM_YARDS_BASE=0x17aed,STADIUM_FIELD_BASE=0xec47;
export const STADIUM_LABEL_POOL=0x86cc00,STADIUM_LABEL_CODE=0x86d000,STADIUM_LABEL_HOOK=0xa4a046;
const POOL=loRom(STADIUM_LABEL_POOL),CODE=loRom(STADIUM_LABEL_CODE),HOOK=loRom(STADIUM_LABEL_HOOK);
const NATIVE_HOOK=Uint8Array.of(0xbf,0x9a,0xf5,0x82),CUSTOM_HOOK=Uint8Array.of(0x22,0,0xd0,0x86);
const equal=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const rule=(id,offset,size,type)=>[id,offset,size,type];
export const STADIUM_RULES=[
 ...Array.from({length:8},(_,i)=>rule(`stadium:name:${i}`,STADIUM_NAME_BASE+i*7,7,'stadium-name')),
 ...Array.from({length:8},(_,i)=>rule(`stadium:yards:${i}`,STADIUM_YARDS_BASE+i*2,2,'stadium-yards')),
 ...Array.from({length:8},(_,i)=>rule(`stadium:field:${i}`,STADIUM_FIELD_BASE+i*4,4,'stadium-field')),
 rule('stadium:labels',POOL,1024,'stadium-layout'),rule('stadium:label-code',CODE,128,'stadium-code'),rule('stadium:label-hook',HOOK,4,'stadium-hook'),
 ...[...new Map(STADIUM_PALETTES.map(p=>[p.address,p])).values()].map(p=>rule(`stadium:palette:${p.address}`,loRom(p.address),p.size,'stadium-palette')),
];
function indexValid(index){if(!Number.isInteger(index)||index<0||index>=8)throw new Error('Estadio inválido.');}
const decode=b=>b===0?' ':b===0x54?'.':b>=0x68&&b<=0x81?String.fromCharCode(65+b-0x68):'�';
export function readStadiums(rom){return Array.from({length:8},(_,index)=>{
 const name=Array.from(rom.slice(STADIUM_NAME_BASE+index*7,STADIUM_NAME_BASE+(index+1)*7),decode).join('').trim();
 return {index,name,lengthYards:rom[STADIUM_YARDS_BASE+index*2],widthYards:rom[STADIUM_YARDS_BASE+index*2+1],length:word(rom,STADIUM_FIELD_BASE+index*4),width:word(rom,STADIUM_FIELD_BASE+index*4+2)};
});}
export function validateStadiumResource(type,bytes){
 if(type==='stadium-name'&&(bytes.length!==7||bytes.some(b=>decode(b)==='�')||!Array.from(bytes,decode).join('').trim()))throw new Error('El nombre admite hasta 7 caracteres A–Z, puntos y espacios.');
 if(type==='stadium-yards'&&(bytes.length!==2||bytes[0]<100||bytes[0]>140||bytes[1]<64||bytes[1]>96))throw new Error('Medidas en yardas fuera de rango (100–140 × 64–96).');
 if(type==='stadium-field'&&(bytes.length!==4||word(bytes,0)<0x700||word(bytes,0)>0x880||word(bytes,2)<0x240||word(bytes,2)>0x2c0||word(bytes,0)%64||word(bytes,2)%64))throw new Error('La cancha admite largo 1792–2176 y ancho 576–704, en pasos de 64.');
 if(type==='stadium-palette'&&(bytes.length%2||bytes.some((b,i)=>i%2&&(b&128))))throw new Error('Paleta BGR555 inválida.');
}
const patch=(id,offset,bytes,label='Estadios')=>({id,offset,bytes:Uint8Array.from(bytes),label});
export function stadiumMeasurePatch(index,kind,length,width){
 indexValid(index);if(!['yards','field'].includes(kind)||![length,width].every(Number.isInteger))throw new Error('Medidas de estadio inválidas.');
 const bytes=kind==='yards'?Uint8Array.of(length,width):Uint8Array.of(length&255,length>>>8,width&255,width>>>8);
 // Validate before truncating to bytes, too.
 if(kind==='yards'&&(length<100||length>140||width<64||width>96)||kind==='field'&&(length<1792||length>2176||width<576||width>704))throw new Error('Medidas de estadio fuera de rango.');
 validateStadiumResource(`stadium-${kind}`,bytes);
 return patch(`stadium:${kind}:${index}`,(kind==='yards'?STADIUM_YARDS_BASE:STADIUM_FIELD_BASE)+index*(kind==='yards'?2:4),bytes);
}
const glyph=c=>c==='.'?186:c===' '?170:(c.charCodeAt(0)-65<16?128+c.charCodeAt(0)-65:160+c.charCodeAt(0)-65-16);
export function stadiumLabelData(rom){
 const bytes=new Uint8Array(1024);
 readStadiums(rom).forEach((s,index)=>{
  const sprites=[],width=Array.from(s.name).reduce((n,c)=>n+(c==='.'||c===' '?4:8),0);let x=Math.floor((80-width)/2);
  for(const c of s.name){if(c===' '){x+=4;continue;}if(c==='.')sprites.push([x,12,186,10]);else sprites.push([x,4,glyph(c),10],[x,12,glyph(c)+16,10]);x+=c==='.'?4:8;}
  const base=index*128;bytes[base]=sprites.length;
  sprites.forEach(([x,y,tile,attr],i)=>{const p=base+i*2;bytes[p+32]=x;bytes[p+64]=y;bytes[p+96]=tile;bytes[p+97]=attr;});
 });return bytes;
}
export function stadiumLabelCode(){
 // Preserve X, Y and DB. Copy four native OAM planes into the first
 // team-name frame, used only by this screen; later screens reload the atlas.
 // The header is a sprite count, X/Y are signed words, tile/attributes a pair.
 const bytes=[0xda,0x5a,0x8b,0xf4,0x7e,0x7e,0xab,0xab,0xa5,0x4c,...Array(7).fill(0x0a),0xaa,0xa0,0,0],loop=bytes.length;
 for(let p=0;p<4;p++){const src=STADIUM_LABEL_POOL+p*32,dest=0x4f02+p*0x2000;bytes.push(0xbf,src&255,src>>>8&255,src>>>16,0x99,dest&255,dest>>>8);}
 bytes.push(0xe8,0xe8,0xc8,0xc8,0xc0,32,0,0xd0);bytes.push((loop-(bytes.length+1))&255);bytes.push(0xab,0x7a,0xfa,0xa9,2,0x4f,0x6b);
 const result=new Uint8Array(128).fill(255);result.set(bytes);return result;
}
export function stadiumNamePatches(original,current,index,text){
 indexValid(index);if(typeof text!=='string')throw new Error('Nombre de estadio inválido.');text=text.trim().toUpperCase();
 if(!/^[A-Z][A-Z .]{0,6}$/.test(text))throw new Error('El nombre admite hasta 7 caracteres A–Z, puntos y espacios.');
 const name=patch(`stadium:name:${index}`,STADIUM_NAME_BASE+index*7,Array.from(text.padStart(7,' '),c=>c===' '?0:c==='.'?0x54:0x68+c.charCodeAt(0)-65)),candidate=current.slice();candidate.set(name.bytes,name.offset);
 const pristine=equal(candidate.slice(STADIUM_NAME_BASE,STADIUM_NAME_BASE+56),original.slice(STADIUM_NAME_BASE,STADIUM_NAME_BASE+56));
 if(pristine)return [name,...['stadium:labels','stadium:label-code','stadium:label-hook'].map(id=>{const [,offset,size]=STADIUM_RULES.find(r=>r[0]===id);return patch(id,offset,original.slice(offset,offset+size));})];
 if(!equal(original.slice(HOOK,HOOK+4),NATIVE_HOOK)&&!equal(original.slice(HOOK,HOOK+4),CUSTOM_HOOK))throw new Error('Cargador de estadios no compatible.');
 if(equal(original.slice(HOOK,HOOK+4),NATIVE_HOOK)&&(!original.slice(POOL,POOL+1024).every(b=>b===255)||!original.slice(CODE,CODE+128).every(b=>b===255)))throw new Error('El espacio reservado para nombres de estadios está ocupado.');
 return [name,patch('stadium:labels',POOL,stadiumLabelData(candidate)),patch('stadium:label-code',CODE,stadiumLabelCode()),patch('stadium:label-hook',HOOK,CUSTOM_HOOK)];
}
export function independentStadiumLabelPatches(original,current){
 if(!equal(current.slice(HOOK,HOOK+4),CUSTOM_HOOK)&&(!current.slice(POOL,POOL+1024).every(b=>b===255)||!current.slice(CODE,CODE+128).every(b=>b===255)))throw new Error('El espacio reservado para nombres de estadios está ocupado.');
 return [patch('stadium:labels',POOL,stadiumLabelData(current)),patch('stadium:label-code',CODE,stadiumLabelCode()),patch('stadium:label-hook',HOOK,CUSTOM_HOOK)];
}
export function validateStadiums(current,original){
 const hook=current.slice(HOOK,HOOK+4);
 if(equal(hook,CUSTOM_HOOK)){
  if(!equal(current.slice(CODE,CODE+128),stadiumLabelCode())||!equal(current.slice(POOL,POOL+1024),stadiumLabelData(current)))throw new Error('Rótulos de estadios inválidos.');
 }else if(!(equal(hook,original.slice(HOOK,HOOK+4))||hasExtraTeams(current)&&equal(hook,Uint8Array.of(0xbf,0x9a,0xc8,0xb0)))||!equal(current.slice(STADIUM_NAME_BASE,STADIUM_NAME_BASE+56),original.slice(STADIUM_NAME_BASE,STADIUM_NAME_BASE+56))||!equal(current.slice(POOL,POOL+1024),original.slice(POOL,POOL+1024))||!equal(current.slice(CODE,CODE+128),original.slice(CODE,CODE+128)))throw new Error('Rótulos de estadios incompletos.');
}
export function stadiumPalettes(rom,index){
 indexValid(index);return STADIUM_PALETTES.filter(p=>(p.stadium===index||p.shared)).map(p=>({...p,id:`stadium:palette:${p.address}`,offset:loRom(p.address),colors:palette(rom,loRom(p.address),p.size/2)}));
}
export function stadiumPalettePatch(rom,id,colorIndex,color){
 const p=STADIUM_RULES.find(r=>r[0]===id&&r[3]==='stadium-palette');if(!p||!Number.isInteger(colorIndex)||colorIndex<0||colorIndex>=p[2]/2)throw new Error('Color de estadio inválido.');
 const bytes=rom.slice(p[1],p[1]+p[2]);bytes.set(rgb555(color),colorIndex*2);return patch(id,p[1],bytes);
}
export function stadiumGraphics(rom,index,colors,allocationRom=rom){
 indexValid(index);return STADIUM_ASSETS.filter(a=>a.stadium===index||a.shared).map(a=>{
  const address=stadiumAssetAddress(rom,a.address),offset=loRom(address),capacity=externalDeluxeLayout(rom)?word(allocationRom,offset)&0x7fff:a.end-a.address,data=decompress(rom,offset),partOffset=a.address===0xa18a0a?word(rom,0x17add+index*2)-0x2280:null,part=partOffset===null?data:data.slice(partOffset,partOffset+384),tileCount=part.length/32,columns=partOffset!==null?4:a.address===0xa185ba?5:[16,12,10,8,6,5,4,3,2,1].find(n=>tileCount%n===0);
  if(partOffset!==null&&(partOffset<0||part.length!==384))throw new Error('Vista de estadio no compatible.');
  return {...a,shared:partOffset!==null?false:a.shared,partOffset,sourceBytes:data,bytes:rom.slice(offset,offset+capacity),id:`stadium:graphic:${a.address}`,offset,actualAddress:address,capacity,bpp:4,columns,decodedSize:data.length,colors:colors||palette(rom,stadiumPalettes(rom,index)[0].offset,16),matrix:tiles(part,4,columns)};
 });
}
export function stadiumGraphicRules(rom){return STADIUM_ASSETS.map(a=>{const offset=loRom(stadiumAssetAddress(rom,a.address));return {id:`stadium:graphic:${a.address}`,offset,size:externalDeluxeLayout(rom)?word(rom,offset)&0x7fff:a.end-a.address,type:'compressed',decodedSize:decompress(rom,offset).length};});}
export function stadiumGraphicPatch(original,resource,matrix){
 const capacity=externalDeluxeLayout(original)?word(original,resource.offset)&0x7fff:resource.capacity;
 if(matrix.length!==resource.matrix.length||matrix.some(row=>row.length!==resource.matrix[0].length||row.some(p=>!Number.isInteger(p)||p<0||p>15)))throw new Error('Resolución gráfica inválida.');
 const decoded=resource.partOffset===null?encodeTiles(matrix,4):resource.sourceBytes.slice();if(resource.partOffset!==null)decoded.set(encodeTiles(matrix,4),resource.partOffset);
 if(equal(decoded,decompress(original,resource.offset)))return patch(resource.id,resource.offset,original.slice(resource.offset,resource.offset+capacity),resource.label);
 if(equal(decoded,resource.sourceBytes)){const bytes=original.slice(resource.offset,resource.offset+capacity);bytes.set(resource.bytes);return patch(resource.id,resource.offset,bytes,resource.label);}
 const encoded=compress(decoded,!!(word(original,resource.offset)&0x8000));
 if(encoded.length>capacity)throw new Error(`El diseño requiere ${encoded.length} bytes; hay ${capacity}. Reduce el detalle.`);
 const bytes=original.slice(resource.offset,resource.offset+capacity);bytes.set(encoded);return patch(resource.id,resource.offset,bytes,resource.label);
}
export function restoreStadiumPatches(original,current,index){
 indexValid(index);const names=externalDeluxeLayout(original)?[]:stadiumNamePatches(original,current,index,readStadiums(original)[index].name);
 const ids=new Set([...stadiumPalettes(original,index).filter(p=>!p.shared).map(p=>p.id),`stadium:yards:${index}`,`stadium:field:${index}`]);
 const mini=stadiumGraphics(current,index).find(r=>r.partOffset!==null),baselineMini=stadiumGraphics(original,index).find(r=>r.partOffset!==null);
 return [...names,stadiumGraphicPatch(original,mini,baselineMini.matrix),...STADIUM_RULES.filter(r=>ids.has(r[0])).map(([id,offset,size])=>patch(id,offset,original.slice(offset,offset+size))),...stadiumGraphicRules(original).filter(r=>STADIUM_ASSETS.find(a=>`stadium:graphic:${a.address}`===r.id).stadium===index).map(r=>patch(r.id,r.offset,original.slice(r.offset,r.offset+r.size)))];
}
