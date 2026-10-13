import {hasExpandedTeams,expandedRomBuffer} from './expanded-layout.mjs';
import {teamCount} from './team-count.mjs';
import {GROUP_LAYOUT_RULES,groupLayoutPatches} from './groups-layout.mjs';
import {loRom} from './binary.mjs';

export const MAX_GROUPS=16;
export const STOCK_GROUP_NAMES=['EUROPE 1','EUROPE 2','EUROPE 3','EUROPE 4','ASIA-AFRICA','N.S.AMERICA','ALL STARS'];
export const GROUP_TEAM_TABLE=0xaefa00,GROUP_PAGE_COUNTS=0xaefcb0,GROUP_PAGE_TITLES=0xaefd90;
const DATA=0xaef300,CODE=0xaef700;
const hooks=[
 ['base',0x85ae79,11],['palette-table',0x85aea1,6],['flag-table',0x85aef2,6],['label-table',0x85af4a,6],
 ['palette-count',0x85aec3,3],['flag-count',0x85af28,3],['label-count',0x85af68,3],
 ['select',0x85af6f,21],['search',0x85af84,28],['vertical',0x85ae19,9],['down',0x85ae50,15],['left',0x85ae5f,12],['right',0x85ae6b,14],
 ['flag-clear',0x85aee1,7],['roster',0x98f80c,15],['mode-count',0x85ac8c,17],['palette-header',0x85ae91,6],
];
const STOCK_HOOK_BYTES=[
 '980a85180a186518851a60','bd3fda29ff00','bd3fda29ff00','bd3fda29ff00',
 'c9ec00','c90c00','c90c00','a5420a0a186542186542186544aabd3fda29ff0060',
 'a20000bd3fda29ff00c526f006e8e02b0090f08aa00600224c8b8060',
 'a5443a3a3a30308544','a5441a1a1ac90600b0bf85444c22ae','c6441005a9050085444c22ae','e644a544c90600900264444c22ae',
 '6410a97f008500','a5420a65420a6544a8b93fda29ff00','ad481689fe0ef005a906008004af72d47e','a92a068d0018',
];
export const GROUP_EDITOR_RULES=[['group-editor:data',loRom(DATA),1024],['group-editor:code',loRom(CODE),768],['group-editor:tables',loRom(GROUP_TEAM_TABLE),1536],...hooks.map(([id,address,size])=>[`group-editor:${id}`,loRom(address),size]),...GROUP_LAYOUT_RULES];
export function hasCustomGroups(rom){return String.fromCharCode(...rom.slice(loRom(DATA),loRom(DATA)+4))==='GRPS';}
export function groupColumns(rom){return hasCustomGroups(rom)&&rom[loRom(DATA)+6]===4?4:3;}
export function groupPageTitles(rom){return groupColumns(rom)===4?0xaefe60:GROUP_PAGE_TITLES;}
export function readGroups(rom){
 if(!hasCustomGroups(rom))return STOCK_GROUP_NAMES.map((name,i)=>({name,teams:Array.from(rom.slice(loRom(0x81da3f)+i*6,loRom(0x81da3f)+(i+1)*6),id=>id/2)}));
 const start=loRom(DATA),count=rom[start+5];
 if(rom[start+4]!==1||![0,4].includes(rom[start+6])||rom[start+7]!==0||count<1||count>MAX_GROUPS)throw new Error('Grupos inválidos.');
 const groups=Array.from({length:count},(_,i)=>{
  const offset=start+8+i*59,raw=rom.slice(offset,offset+16),end=raw.indexOf(0),n=rom[offset+16];
  if(end<1||raw.slice(end).some(Boolean)||n>42||rom.slice(offset+17+n,offset+59).some(b=>b!==255))throw new Error('Grupos inválidos.');
  return {name:String.fromCharCode(...raw.slice(0,end)),teams:Array.from(rom.slice(offset+17,offset+17+n))};
 });
 validateGroups(groups,teamCount(rom));return groups;
}
export function validateGroups(groups,limit=42){
 if(!Array.isArray(groups)||groups.length<1||groups.length>MAX_GROUPS)throw new Error('Se permiten entre 1 y 16 grupos.');
 for(const group of groups){
  if(typeof group.name!=='string'||! /^[A-Z0-9][A-Z0-9 .-]{0,14}$/.test(group.name))throw new Error('El grupo admite hasta 15 letras A–Z, números, espacios, puntos o guiones.');
  if(!Array.isArray(group.teams)||group.teams.length>42||new Set(group.teams).size!==group.teams.length||group.teams.some(i=>!Number.isInteger(i)||i<0||i>=limit))throw new Error('Equipos de grupo inválidos.');
 }
 if(!groups.some(g=>g.teams.length))throw new Error('Debe quedar al menos un equipo en los grupos.');
}
export function groupDataPatch(groups,columns=3,limit=42){
 if(![3,4].includes(columns))throw new Error('Selecciona 3 o 4 columnas.');
 validateGroups(groups,limit);const [id,offset,size]=GROUP_EDITOR_RULES[0],bytes=new Uint8Array(size).fill(255);
 bytes.set([71,82,80,83,1,groups.length,columns===4?4:0,0]);
 groups.forEach((g,i)=>{const p=8+i*59;bytes.fill(0,p,p+16);bytes.set(Array.from(g.name,c=>c.charCodeAt(0)),p);bytes[p+16]=g.teams.length;bytes.set(g.teams,p+17);});
 return {id,offset,bytes,label:'Grupos y equipos'};
}
export function groupPages(groups,columns=3){
 const size=columns===4?4:6,pages=[];groups.forEach((g,index)=>{for(let i=0;i<g.teams.length;i+=size)pages.push({group:index,teams:g.teams.slice(i,i+size)});});return pages;
}
// Small label-aware assembler for the injected 16-bit A/X/Y routines. The
// original caller's direct page and data bank are preserved by every helper.
function selectorCode(pages,legacy={}){
 const four=legacy.columns===4,stride=four?4:6,counts=four?0xaefd00:GROUP_PAGE_COUNTS;
 const bytes=[],labels={},fixups=[];const emit=(...b)=>bytes.push(...b),label=n=>labels[n]=bytes.length;
 const branch=(op,n)=>{emit(op,0);fixups.push([bytes.length-1,n]);};
 const long=a=>[a&255,a>>>8&255,a>>>16],word=n=>[n&255,n>>>8&255];
 const loadCount=()=>emit(0xa5,0x42,0x0a,0xaa,0xbf,...long(counts));
 label('base');emit(0x98,0x0a,0xaa,0xbf,...long(counts),0x0a,0x85,0x1e,0x0a,0x0a,0x0a,0x18,0x69,0x8c,0,0x85,0x1c,0x98,0x0a,...(four?[0x0a]:[0x85,0x18,0x0a,0x18,0x65,0x18]),0x85,0x1a,0x6b);
 label('select');emit(0xda);loadCount();emit(0xc5,0x44);branch(0xf0,'select-reset');branch(0xb0,'select-valid');label('select-reset');emit(0x64,0x44);label('select-valid');emit(0xa5,0x42,0x0a,0x0a,...(four?[]:[0x18,0x65,0x42,0x18,0x65,0x42]),0x18,0x65,0x44,0xaa,0xbf,...long(GROUP_TEAM_TABLE),0x29,0xff,0,0xfa,0x6b);
 if(!legacy.directRead){label('read');emit(0xbf,...long(GROUP_TEAM_TABLE),0x29,0xff,0,0x6b);}
 label('search');emit(0xa2,0,0);label('search-loop');emit(0xbf,...long(GROUP_TEAM_TABLE),0x29,0xff,0,0xc5,0x26);branch(0xf0,'search-found');emit(0xe8,0xe0,...word(pages.length*stride));branch(0x90,'search-loop');emit(0xa2,0,0);label('search-found');emit(0x8a,0xa0,stride,0,0x22,0x4c,0x8b,0x80,0x6b);
 label('vertical');if(four)emit(0x6b);else{emit(0xda);loadCount();emit(0x85,0xf8,0xa5,0x44,0xc9,3,0);branch(0xb0,'vertical-upper');emit(0x18,0x69,3,0,0xc5,0xf8);branch(0xb0,'nav-done');branch(0x80,'nav-store');label('vertical-upper');emit(0x38,0xe9,3,0);branch(0x80,'nav-store');}
 label('left');emit(0xda);loadCount();emit(0x85,0xf8,0xa5,0x44);branch(0xf0,'left-wrap');emit(0x3a);branch(0x80,'nav-store');label('left-wrap');emit(0xa5,0xf8,0x3a);branch(0x80,'nav-store');
 label('right');emit(0xda);loadCount();emit(0x85,0xf8,0xa5,0x44,0x1a,0xc5,0xf8);branch(0x90,'nav-store');emit(0xa9,0,0);label('nav-store');emit(0x85,0x44);label('nav-done');emit(0xfa,0x6b);
 // Blank only absent slots through the same DMA queue as the stock loops.
 // The zero source is in the reserved ROM code pool, so no WRAM asset is lost.
 if(legacy.ramClear){
  label('clear');emit(0x08,0xc2,0x30,0xda,0x5a,0xa9,0,0,0xa2,0,0);label('clear-loop');
  emit(0x9f,0,0x70,0x7f,0xe8,0xe8,0xe0,0,4);branch(0x90,'clear-loop');emit(0xa2,0,0);label('clear-names');emit(0x9f,0xc0,0x4c,0x7f,0xe8,0xe8,0xe0,0x60,1);branch(0x90,'clear-names');emit(0x7a,0xfa,0x28,0xa9,0x7f,0,0x85,0,0x6b);
 }else{
 label('clear');emit(0xa9,0xae,0,0x85,0,0xa5,0x1e,0x85,0x10);label('clear-loop');emit(0xa5,0x10,0xc9,12,0);branch(0xb0,'clear-done');
 emit(0xaa,0xbf,0x7d,0xf8,0x82,0xa8,0xa9,0x80,0xf9,0xa2,0x60,0,0x22,0x37,0x8e,0x80);
 emit(0xa6,0x10,0xbf,0x7d,0xf8,0x82,0x18,0x69,0,1,0xa8,0xa9,0x80,0xf9,0xa2,0x60,0,0x22,0x37,0x8e,0x80);
 emit(0xa6,0x10,0xbf,0xf7,0xf7,0x82,0xa8,0xa9,0x80,0xf9,0xa2,0x40,0,0x22,0x37,0x8e,0x80,0xe6,0x10,0xe6,0x10);branch(0x80,'clear-loop');label('clear-done');emit(0xa9,0x7f,0,0x85,0,0x6b);
 }
 // Script opcode $2A consumes the count in its high byte. Its header must
 // describe the same number of entries as the variable-length palette loop.
 if(!legacy.fixedPaletteHeader){label('palette-header');emit(0xa5,0x1e,0x4a,0xeb,0x09,0x2a,0,0x8d,0,0x18,0x6b);}
 for(const [offset,name] of fixups){const delta=labels[name]-offset-1;if(delta< -128||delta>127)throw new Error('Código de grupos fuera de rango.');bytes[offset]=delta&255;}
 const result=new Uint8Array(768).fill(0xea);if(bytes.length>640)throw new Error('Código de grupos fuera de rango.');result.set(bytes);if(!legacy.ramClear)result.fill(0,640);return {bytes:result,addresses:Object.fromEntries(Object.entries(labels).map(([n,p])=>[n,CODE+p]))};
}
export function groupSelectorPatches(original,groups,legacy={}){
 if(!hasCustomGroups(original))hooks.forEach(([,address],i)=>{const bytes=STOCK_HOOK_BYTES[i].match(/../g).map(b=>parseInt(b,16)),offset=loRom(address);if(bytes.some((b,j)=>b!==original[offset+j]))throw new Error('Código de grupos no compatible.');});
 const columns=legacy.columns||3,stride=columns===4?4:6,counts=columns===4?0xaefd00:GROUP_PAGE_COUNTS,titles=columns===4?0xaefe60:GROUP_PAGE_TITLES;
 const pages=groupPages(groups,columns),code=selectorCode(pages,legacy),tables=new Uint8Array(1536).fill(255),tableStart=loRom(GROUP_TEAM_TABLE);
 const putWord=(address,n)=>{const p=loRom(address)-tableStart;tables[p]=n&255;tables[p+1]=n>>>8;};
 pages.forEach((p,i)=>{tables.set(p.teams.map(t=>t*2),i*stride);putWord(counts+i*2,p.teams.length);putWord(titles+i*2,p.group);});
 const values=new Map([['data',groupDataPatch(groups,columns,legacy.teamLimit||42).bytes],['code',code.bytes],['tables',tables]]);
 const call=n=>{const a=code.addresses[n];return [0x22,a&255,a>>>8&255,a>>>16];};
 values.set('base',[...call('base'),0x60]);
 for(const id of ['palette-table','flag-table','label-table'])values.set(id,legacy.directRead?[0xbf,0,0xfa,0xae,0xea,0xea]:[...call('read'),0xea,0xea]);
 values.set('palette-count',[0xc5,0x1c,0xea]);for(const id of ['flag-count','label-count'])values.set(id,[0xc5,0x1e,0xea]);
 values.set('select',[...call('select'),0x60]);values.set('search',[...call('search'),0x60]);
 for(const id of ['vertical','down','left','right'])values.set(id,[...call(id==='down'?'vertical':id),0x4c,0x22,0xae]);
 values.set('flag-clear',[...call('clear'),0x64,0x10,0xea]);values.set('roster',call('select'));values.set('mode-count',[0xa9,pages.length,0]);
 values.set('palette-header',legacy.fixedPaletteHeader?[0xa9,0x2a,6,0x8d,0,0x18]:[...call('palette-header'),0xea,0xea]);
 const patches=GROUP_EDITOR_RULES.filter(([id])=>!id.startsWith('group-editor:layout-')).map(([id,offset,size])=>{const value=values.get(id.slice(13)),bytes=new Uint8Array(size).fill(0xea);bytes.set(value);return {id,offset,bytes,label:'Grupos y equipos'};});
 // Every game mode now uses the configured pages, including the unlock path.
 const countOffset=loRom(0x85a566),modeCounts=original.slice(countOffset,countOffset+15);modeCounts[1]=pages.length;modeCounts[13]=pages.length;
 patches.push(...groupLayoutPatches(original,columns,legacy));
 patches.push({id:'selection:all-stars',offset:countOffset,bytes:modeCounts,label:'Páginas de grupos'});
 return patches;
}
export function validateGroupEditor(rom,original){
 if(!hasCustomGroups(rom)){
  for(const [id,offset,size] of GROUP_EDITOR_RULES)if(rom.slice(offset,offset+size).some((b,i)=>b!==original[offset+i]))throw new Error(`Código de grupos no compatible: ${id}.`);
  return;
 }
 const groups=readGroups(rom);
 for(const patch of groupSelectorPatches(original,groups,{columns:groupColumns(rom),teamLimit:teamCount(rom)}))if(patch.bytes.some((b,i)=>rom[patch.offset+i]!==b))throw new Error(`Código de grupos no compatible: ${patch.id}.`);
}

// Recognize only exact instruction sets emitted during development of this
// format. A known saved draft is upgraded atomically; unknown code is rejected.
export function upgradeGroupSelector(original,patches){
 const candidate=hasExpandedTeams(original)||patches.some(p=>p.id==='teams:metadata'&&p.bytes[4]===3)?expandedRomBuffer(original):original.slice();for(const p of patches)candidate.set(p.bytes,p.offset);
 if(!hasCustomGroups(candidate))return patches;
 const groups=readGroups(candidate);
 for(const legacy of [{columns:4,fullHeightBackground:true},{fixedPaletteHeader:true},{ramClear:true,fixedPaletteHeader:true},{ramClear:true,directRead:true,fixedPaletteHeader:true}]){
  const expected=groupSelectorPatches(original,groups,{...legacy,teamLimit:teamCount(candidate)});
  if(expected.every(p=>p.bytes.every((b,i)=>candidate[p.offset+i]===b))){
   const upgraded=groupSelectorPatches(original,groups,{columns:groupColumns(candidate),teamLimit:teamCount(candidate)}),ids=new Set(upgraded.map(p=>p.id));
   return [...patches.filter(p=>!ids.has(p.id)),...upgraded];
  }
 }
 return patches;
}
