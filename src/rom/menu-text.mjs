import {externalDeluxeLayout} from './external-layout.mjs';
import {loRom,word,decompress,tiles} from './binary.mjs';
import {compress} from './compression.mjs';
import {mainMenuBackground} from './main-menu.mjs';

// Bank $87 MI scripts: op $1C/$18 draws TallMenuText, op $22/$26
// draws SmallMenuText through DATA_87C016. Fixed slots exclude all MI
// opcodes, pointers and control sequences. Game-start labels live in BG3.
const tall=new Map([[' ',0],...Array.from('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',(c,i)=>[c,0x5e+i]),...Array.from("!.+-%/'~:?",(c,i)=>[c,[0x52,0x54,0x56,0x57,0x58,0x59,0x5a,0x5b,0x5c,0x5d][i]])]);
const small=new Map(Array.from(' 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ:-!%.abcdefghijklmnopqrstuvwxyz()',(c,i)=>[c,i]));
for(const [c,id] of [['+',0x47],['=',0x48],['<',0x49],['>',0x4a],['$',0x4b],['?',0x4c],['*',0x4d],['#',0x4e],['~',0x4f],["'",0x50],['/',0x51],[',',0x52]])small.set(c,id);
const letters=font=>new Map([...(font==='small'?small:tall)].map(([c,b])=>[b,c]));
const slot=(key,label,address,columns,rows,position,font='tall',extra={})=>({key,label,offset:loRom(address),columns,rows,position,font,...extra});
export const MENU_SCREENS=[
 {id:'secondary',label:'Menú secundario',fields:[
  ...['OPEN GAME','SHORT LEAGUE','SHORT TOURNAMENT'].map((label,i)=>slot(`option-${i}`,label,0x87da0d+i*16,16,1,0x00a8+i*0x60)),
  slot('description-0','Single game only.',0x87da3d,17,1,0x0228,'tall',{option:0}),
  slot('description-1','League up to six players.',0x87da4e,17,2,0x0208,'tall',{option:1}),
  slot('description-2','Tournament up to eight players.',0x87da70,17,2,0x0208,'tall',{option:2}),
 ]},
 {id:'settings',label:'Menú settings',fields:[
  slot('level','GAME LEVEL',0x87dde8,10,1,0x00a3),slot('time','GAME TIME',0x87ddf2,9,1,0x0103),
  slot('sound','SOUND',0x87de03,5,1,0x0163),slot('stereo','STEREO',0x87de08,6,1,0x016f),
  slot('mono','MONO',0x87de0e,4,1,0x0178),slot('rules','RULES',0x87de12,5,1,0x01c3),
 ]},
 {id:'training',label:'Menú training',fields:[
  slot('training','TRAINING',0x87de77,9,1,0x0108),slot('challenge','CHALLENGE',0x87de80,9,1,0x0168),
  slot('mode','MODE',0x87df61,4,1,0x0111,'tall',{shared:true,positions:[0x0111,0x0172]}),
  slot('description-0','Descripción de training',0x87de89,22,4,0x0245,'small',{option:0}),
  slot('description-1','Descripción de challenge',0x87dee1,22,4,0x0245,'small',{option:1}),
 ]},
 {id:'handicap',label:'Menú handicap',fields:[
  slot('title','-HANDICAP-',0x87c811,10,1,0x004b),
  slot('condition','CONDITION',0x87c81b,4,2,0x012e,'small',{nativeText:'CONDITION'}),
  slot('players','NUMBEROF PLAYERS',0x87c823,6,2,0x01ad,'small',{nativeText:'NUMBEROF\nPLAYERS'}),
  slot('skill','GOALKEEPER SKILL',0x87c845,8,2,0x022c,'small',{nativeText:'GOALKEEPER\nSKILL'}),
  slot('strong','STRONG',0x87c859,4,1,0x0207,'small',{nativeText:'STRONG',positions:[0x0207,0x0215]}),
  slot('weak','WEAK',0x87c855,4,1,0x0202,'small',{nativeText:'WEAK',positions:[0x0202,0x021a]}),
  slot('hint','Instrucciones de handicap',0x87c884,27,2,0x02e3),
 ]},
 {id:'game',label:'Menú juego',fields:['GAME START','SELECT SQUAD','FORMATION CHANGE','ADJUST STRATEGY','MAN TO MAN','KEY CONFIGURATION','CHANGE CONTROLLER','NUMBEROF PLAYERS','EDIT PLAYER SKILS','TEAM COLORS'].map((label,i)=>({key:`option-${i}`,label,font:'tall',columns:15,rows:1,position:(4+i*2)*32+9,map:true,index:i}))},
];
// FREE_BYTES $AAFC3F..$AAFFFF. Only the initial game-start map loader
// is redirected; halftime/season/tournament maps keep their own pointers.
const MAP_ADDRESS=0x9bbef7,MAP_POOL_ADDRESS=0xaafc3f,MAP_POOL=loRom(MAP_POOL_ADDRESS),MAP_SIZE=961,MAP_LOADER=loRom(0x829201);
const rawFields=MENU_SCREENS.flatMap(s=>s.fields.filter(f=>!f.map).map(f=>({...f,id:`menu-text:${s.id}:${f.key}`})));
export const MENU_TEXT_RULES=[...rawFields.map(f=>[f.id,f.offset,f.columns*f.rows]),['menu-text:game:map',MAP_POOL,MAP_SIZE],['menu-text:game:loader',MAP_LOADER,3]];
const equal=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
export function menuScreen(id){const screen=MENU_SCREENS.find(s=>s.id===id);if(!screen)throw new Error('Menú inválido.');return screen;}
function fieldFor(screenId,key){const screen=menuScreen(screenId),field=screen.fields.find(f=>f.key===key);if(!field)throw new Error('Texto de menú inválido.');return {...field,id:`menu-text:${screenId}:${key}`};}
function tallPair(rom,code){return [rom[loRom(0x87be6a)+code*2],rom[loRom(0x87be6a)+code*2+1]];}
function mapAddress(rom){const address=word(rom,MAP_LOADER)|rom[MAP_LOADER+2]<<16;if(!externalDeluxeLayout(rom)&&![MAP_ADDRESS,MAP_POOL_ADDRESS].includes(address))throw new Error('Composición del menú juego inválida.');return loRom(address);}
function gameMap(rom){return decompress(rom,mapAddress(rom));}
function mapText(rom,field){
 const map=gameMap(rom),codes=[...tall],result=[];
 for(let i=0;i<field.columns;i++){
  const top=word(map,(field.position+i)*2)&1023,bottom=word(map,(field.position+32+i)*2)&1023;
  const char=codes.find(([,code])=>{const pair=tallPair(rom,code);return pair[0]===top&&pair[1]===bottom;})?.[0];
  if(char===undefined)return null;result.push(char);
 }
 return result.join('').trimEnd();
}
export function readMenuText(rom,screenId,key){
 const f=fieldFor(screenId,key);
 if(f.map)return {...f,text:mapText(rom,f)??f.label};
 const bytes=rom.slice(f.offset,f.offset+f.columns*f.rows),alphabet=letters(f.font);
 if(f.nativeText&&bytes.some(b=>!alphabet.has(b)))return {...f,bytes,text:f.nativeText};
 const lines=Array.from({length:f.rows},(_,row)=>Array.from(bytes.slice(row*f.columns,(row+1)*f.columns),b=>alphabet.get(b)??'�').join('').trimEnd());
 return {...f,bytes,text:lines.join('\n').trimEnd()};
}
function encodeText(field,text){
 const alphabet=field.font==='small'?small:tall;
 const lines=String(text).replace(/\r\n?/g,'\n').split('\n');
 if(lines.length>field.rows||lines.some(l=>l.length>field.columns))throw new Error('El texto excede las líneas o los caracteres disponibles para este rótulo.');
 if(!lines.some(l=>l.trim()))throw new Error('El rótulo no puede quedar vacío.');
 if(Array.from(lines.join('')).some(c=>!alphabet.has(c)))throw new Error('Usa letras sin tildes, números, espacios y puntuación compatible con la fuente del menú.');
 return Uint8Array.from(Array.from({length:field.rows},(_,i)=>(lines[i]||'').padEnd(field.columns,' ')).join(''),c=>alphabet.get(c));
}
export function menuTextPatches(original,current,screenId,key,text){
 const f=fieldFor(screenId,key),bytes=encodeText(f,text);
 if(!f.map)return [{id:f.id,offset:f.offset,bytes,label:`${menuScreen(screenId).label} · ${f.label}`}];
 const map=gameMap(current);
 for(let i=0;i<f.columns;i++)tallPair(current,bytes[i]).forEach((tile,row)=>{const p=(f.position+row*32+i)*2;map[p]=tile;map[p+1]=0x20;});
 return mapPatches(original,map);
}
function mapPatches(original,map){
 const pristine=gameMap(original),bytes=original.slice(MAP_POOL,MAP_POOL+MAP_SIZE),loader=original.slice(MAP_LOADER,MAP_LOADER+3);
 if(!equal(map,pristine)){
  if(mapAddress(original)!==MAP_POOL&&!bytes.every(b=>b===255))throw new Error('El espacio reservado para el menú juego está ocupado.');
  const encoded=compress(map);if(encoded.length>MAP_SIZE)throw new Error('El texto del menú juego excede su espacio comprimido. Acorta los rótulos.');bytes.fill(255);bytes.set(encoded);loader.set([0x3f,0xfc,0xaa]);
 }
 return [{id:'menu-text:game:map',offset:MAP_POOL,bytes,label:'Menú juego · rótulos'},{id:'menu-text:game:loader',offset:MAP_LOADER,bytes:loader,label:'Menú juego · composición'}];
}
export function restoreMenuTextPatches(original,current,screenId,key){
 const f=fieldFor(screenId,key);
 if(!f.map)return [{id:f.id,offset:f.offset,bytes:original.slice(f.offset,f.offset+f.columns*f.rows),label:`${menuScreen(screenId).label} · ${f.label}`}];
 const map=gameMap(current),native=gameMap(original);
 for(let row=0;row<2;row++){const p=(f.position+row*32)*2;map.set(native.slice(p,p+f.columns*2),p);}
 return mapPatches(original,map);
}
export function validateMenuTexts(rom,original){
 for(const f of rawFields){
  const bytes=rom.slice(f.offset,f.offset+f.columns*f.rows),native=original.slice(f.offset,f.offset+f.columns*f.rows);
  if(equal(bytes,native))continue;
  if(bytes.every(b=>b===0)||bytes.some(b=>!letters(f.font).has(b)))throw new Error('Texto de menú inválido.');
 }
 const offset=mapAddress(rom),map=gameMap(rom),native=gameMap(original);
 if(map.length!==2048||(word(rom,offset)&0x8000)||(word(rom,offset)&0x7fff)>MAP_SIZE)throw new Error('Composición del menú juego inválida.');
 if(offset!==MAP_POOL&&!equal(rom.slice(MAP_POOL,MAP_POOL+MAP_SIZE),original.slice(MAP_POOL,MAP_POOL+MAP_SIZE)))throw new Error('Composición del menú juego inválida.');
 if(offset===MAP_POOL&&mapAddress(original)!==MAP_POOL&&!original.slice(MAP_POOL,MAP_POOL+MAP_SIZE).every(b=>b===255))throw new Error('El espacio reservado para el menú juego está ocupado.');
 const editable=new Set();
 for(const f of menuScreen('game').fields){
  let changed=false;
  for(let row=0;row<2;row++)for(let x=0;x<f.columns;x++){const p=(f.position+row*32+x)*2;editable.add(p);editable.add(p+1);changed ||= map[p]!==native[p]||map[p+1]!==native[p+1];}
  if(changed&&(mapText(rom,f)===null||!mapText(rom,f)||Array.from({length:2},(_,row)=>Array.from({length:f.columns},(_,x)=>word(map,(f.position+row*32+x)*2))).flat().some(e=>(e&0xfc00)!==0x2000)))throw new Error('Rótulo del menú juego inválido.');
 }
 if(map.some((b,i)=>!editable.has(i)&&b!==native[i]))throw new Error('Composición del menú juego inválida.');
}

// Recreate BG3 VRAM from the cartridge's native DMA lists, including the
// shared font and the scene-specific atlases used by handicap/game labels.
function menuFont(rom,id){
 const bytes=new Uint8Array(16384);
 for(const [v,a] of [[0x43e0,0x9b8000],[0x4700,0x9b81fa],[0x4480,0x9b8337],[0x4000,0x9b849d],[0x41a8,0x9b8619],[0x4600,0x9b80d9],[0x4698,0x9b8181],[0x46e8,0x9b80be],[0x4290,0xadbaf9],[0x4c00,0xa0a100],...(id==='handicap'?[[0x4c00,0x9ef615],[0x4d00,0x9ef691]]:id==='game'?[[0x5000,0x9ee31c]]:[])])bytes.set(decompress(rom,loRom(a)),(v-0x4000)*2);
 return tiles(bytes,2,1);
}
export function menuTextPreview(rom,screenId,key){
 const screen=menuScreen(screenId),selected=fieldFor(screenId,key),font=menuFont(rom,screenId);
 const background=mainMenuBackground(rom),matrix=background.matrix;
 const foreground=background.colors.length;
 const colors=[...background.colors,'#304fc7','#060d82','#00d8d8','#ffffff','#000000','#8c8c8c','#ffff00'];
 const panel=(x,y,w,h)=>{for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++)matrix[py][px]=foreground+(py===y||py===y+h-1||px===x||px===x+w-1?2:1);};
 const box={secondary:[56,32,144,80],settings:[16,32,224,104],training:[56,56,144,56],handicap:[8,64,240,104],game:[64,24,144,176]}[screenId];panel(...box);
 if(['secondary','training'].includes(screenId))panel(48,136,160,48);
 const paint=(tile,position,highlight)=>{const x=(position%32)*8,y=Math.floor(position/32)*8;for(let yy=0;yy<8;yy++)for(let xx=0;xx<8;xx++){const pixel=font[tile*8+yy]?.[xx]??0;if(pixel&&matrix[y+yy]?.[x+xx]!==undefined)matrix[y+yy][x+xx]=foreground+(highlight&&pixel===1?6:pixel+2);}};
 if(screenId==='game'){
  const map=gameMap(rom);
  for(let y=0;y<28;y++)for(let x=0;x<32;x++){const index=y*32+x,tile=word(map,index*2)&1023;paint(tile,index,index>=selected.position&&index<selected.position+selected.columns||index>=selected.position+32&&index<selected.position+32+selected.columns);}
 }else for(const field of screen.fields){
  if(field.option!==undefined&&field.option!==(selected.option??(key==='challenge'?1:screenId==='secondary'&&key.startsWith('option-')?Number(key.slice(-1)):0)))continue;
  const bytes=rom.slice(field.offset,field.offset+field.columns*field.rows);
  for(const position of field.positions||[field.position])bytes.forEach((code,i)=>{
   const row=Math.floor(i/field.columns),x=i%field.columns,p=position+row*32*(field.font==='tall'?2:1)+x;
   if(field.font==='tall')tallPair(rom,code).forEach((tile,j)=>paint(tile,p+j*32,field.key===key));
   else paint(word(rom,loRom(0x87c016)+code*2)&1023,p,field.key===key);
  });
 }
 return {matrix,colors};
}
