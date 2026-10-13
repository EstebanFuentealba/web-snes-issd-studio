import {hasExpandedTeams} from './expanded-layout.mjs';
import {loRom,word} from './binary.mjs';
import {TEAM_METADATA,TEAM_TABLES,hasEmptyTeams,teamDataRom,teamCount,teamExists,activeTeamIds,hasExtraTeams,hasPhysicalTeams,teamTable,teamPointer,attributeOffset,PHYSICAL_STAR_NAMES,PHYSICAL_FALLBACK_NAMES,FALLBACK_NAMES,COMPACT_GLYPH_ATLAS,COMPACT_GLYPH_ATLAS_SIZE} from './team-count.mjs';
import {addTeamPatches,extraTeamCodePatches,TEAM_PHOTO_TABLES} from './extra-teams.mjs';
import {deluxePlayerNameOffset} from './deluxe.mjs';
import {flagMatrix,flagPatches,smallLabelMatrix,encodeTiles,compress,FLAG_SLOT,LABEL_SLOT,LABEL_POOL,selectionFlagAddress} from './graphics.mjs';
import {labelLayout,labelFrame,labelLayoutPatch,bigTeamNamePatches,smallTeamNamePatches,compactGlyphAtlas,compatibleTeamLabelSlot} from './team-labels.mjs';
import {editableGroups,editGroupsPatches} from './group-editor.mjs';
import {readScenarios,scenarioPatch} from './scenarios.mjs';
import {independentStadiumLabelPatches} from './stadiums.mjs';

const palettes=[[0x1027a,16],[0x102d0,16],[0x10326,11],[0x1037c,5],[0x103d2,1],[0xe7d8,4]];
const flags=loRom(0xb0ca40),tables=loRom(0xb0c400),photos=loRom(0xafec00);
const patch=(id,offset,bytes)=>({id,offset,bytes:Uint8Array.from(bytes),label:'Eliminación física de equipos'});
const putWord=(bytes,offset,n)=>bytes.set([n&255,n>>>8],offset);
const apply=(rom,changes)=>{for(const p of changes)rom.set(p.bytes,p.offset);};
const blank=(n)=>new Uint8Array(n).fill(255);
// $98F014 is the shared transparent tile used by the native dynamic-sprite
// loader ($84E80E), including referees and players without jersey details.
export const SHARED_BLANK_DETAIL=loRom(0x98f014);
function whiteFlagPatches(original,current,team){
 const offset=loRom(0x890000|teamPointer(current,0xe7d8,team))+4;
 return [...flagPatches(original,current,team,Array.from({length:16},()=>Array(24).fill(13))),patch(`palette:${offset}`,offset,[255,127])];
}
const stride=table=>table===0xe730?4:[0x1042e,0x104af].includes(table)?1:2;
const nativeName=t=>loRom(0x87818e)+t*160;
const slotName=t=>t<36?nativeName(t):t<42?loRom(PHYSICAL_STAR_NAMES)+(t-36)*160:loRom(0x87fac8)+(t-42)*160;
const slotFormation=(rom,t)=>t<42?loRom(0x8b0000|word(rom,0x5ef48+t*2)):loRom(0x8bfdd0)+(t-42)*31;
const nativeGraphicTables=rom=>[[0xe730,word(rom,0xe730)===0xbd1e?0xaf:0xa7,2],...(word(rom,0xe6c1)===0xdf00?[]:[[0xe6c1,0x9a,1]])];

export function physicalTeamResources(rom){
 const out=[];
 for(let t=0;t<48;t++){
  if(t<42)for(let i=0;i<20;i++){
   const n=slotName(t)+i*8,a=attributeOffset(rom,t,i);
   out.push([`name:${n}`,n,8,'name'],[`attributes:${a}`,a,7,'attributes']);
  }
  const f=slotFormation(rom,t);out.push([`formation:${f}`,f,31,'formation']);
  if(t<42)for(const [table,count] of palettes){const pointer=word(rom,table+t*2);if(pointer)for(let i=0;i<count;i++){const off=loRom(0x890000|pointer)+2+i*2;out.push([`palette:${off}`,off,2,'palette']);}}
 }
 for(const [a,n] of [[FALLBACK_NAMES,160],[PHYSICAL_FALLBACK_NAMES,160]])out.push([`teams:fallback:${a}`,loRom(a),n,'relocated-storage']);
 out.push(['teams:compact-font',loRom(COMPACT_GLYPH_ATLAS),COMPACT_GLYPH_ATLAS_SIZE,'relocated-storage']);
 out.push(['teams:native-name-pointers',0x38138,86,'relocated-storage']);
 for(let i=0;i<6;i++){const offset=loRom(0xa4f64f)+i*80;out.push([`teams:star-references:${i}`,offset,80,'relocated-storage']);}
 // Obsolete native graphic allocations retain their two-byte size headers,
 // so an exported ROM can reconstruct this exact resource registry.
 for(let t=0;t<42;t++){
  for(const [table,bank,parts] of nativeGraphicTables(rom))for(let i=0;i<parts;i++){
   const offset=loRom(bank<<16|word(rom,table+t*parts*2+i*2)),size=bank===0xaf&&table===0xe730?FLAG_SLOT:word(rom,offset)&0x7fff;
   if(size>=3&&offset+size<=rom.length)out.push([`native-storage:${offset}`,offset,size,'native-storage']);
  }
  // Use the sprite editor's detail ID: graphic:804308 is also the legacy
  // 8192-byte jersey atlas, whose allocation must remain distinct.
  const offset=loRom(0x980000|word(rom,0xce8a+t*2));out.push([`detail:${offset}`,offset,32,'raw']);
 }
 return [...new Map(out.map(r=>[r[0],r])).values()];
}

function copyNames(rom,t){const bytes=new Uint8Array(160);for(let i=0;i<20;i++)bytes.set(rom.slice(deluxePlayerNameOffset(rom,t,i),deluxePlayerNameOffset(rom,t,i)+8),i*8);return bytes;}
export function physicalFallbackNamePatches(rom){rom=teamDataRom(rom);const names=copyNames(rom,activeTeamIds(rom)[0]);return [FALLBACK_NAMES,PHYSICAL_FALLBACK_NAMES].map(a=>patch(`teams:fallback:${a}`,loRom(a),names));}
function frameCopy(layout,target,source=null){
 const f=labelFrame(layout,target),s=source===null?null:labelFrame(layout,source);
 const values=s?Array.from({length:4},(_,p)=>layout.data.slice(layout.base+s.start+p*layout.sprites,layout.base+s.start+s.count+p*layout.sprites)):null;
 for(let p=0;p<4;p++)for(let i=0;i<f.count;i++)layout.data[layout.base+f.start+i+p*layout.sprites]=values?.[p][i]??[0,4,170,10][p];
}

// All tables resolve a removed ID to a surviving squad, including calls from
// native tournament modes that still use the cartridge's fixed 36-country IDs.
function structuralPatches(original,current){
 const ids=activeTeamIds(current),fallback=ids[0];if(fallback===undefined)throw new Error('Debe quedar al menos un equipo en la ROM.');
 const metadata=current.slice(TEAM_METADATA,TEAM_METADATA+256);metadata[4]=2;metadata.fill(0,14,210);
 for(let t=0;t<49;t++){
  const mapped=t===48?48:teamExists(current,t)?t:fallback;
  putWord(metadata,14+t*2,mapped*2);
  putWord(metadata,112+t*2,t===48?0x96f8:attributeOffset(current,mapped)-loRom(0x8a8000)+0x8000);
 }
 const changes=[patch('teams:metadata',TEAM_METADATA,metadata)],candidate=current.slice();apply(candidate,changes);
 const tableBytes=current.slice(tables,tables+0x640);
 for(const [key,address] of Object.entries(TEAM_TABLES)){
  const table=Number(key),step=stride(table),base=loRom(address)-tables;
  for(let t=0;t<48;t++){
   const mapped=teamExists(candidate,t)?t:fallback;
   if(table===0xe730){putWord(tableBytes,base+t*4,0xca40+mapped*2*FLAG_SLOT);putWord(tableBytes,base+t*4+2,0xca40+(mapped*2+1)*FLAG_SLOT);}
   else if(table===0xe6c1)putWord(tableBytes,base+t*2,0xdf00+mapped*LABEL_SLOT);
   else if(table===0x38138)putWord(tableBytes,base+t*2,teamExists(candidate,t)?(slotName(t)&0x7fff)|0x8000:0xfe88);
   else if(table===0x1759a||table===0x17829){if(!teamExists(candidate,t))putWord(tableBytes,base+t*2,teamPointer(current,table,fallback));}
   else if(t<42){
    const src=teamExists(candidate,t)?table+t*step:(fallback<42?table:teamTable(current,table))+fallback*step;
    tableBytes.set(current.slice(src,src+step),base+t*step);
   }else if(!teamExists(candidate,t)){const src=(fallback<42?table:teamTable(current,table))+fallback*step;tableBytes.set(current.slice(src,src+step),base+t*step);}
  }
 }
 // Active additional slots always own their fixed formation/palette storage.
 for(let t=42;t<teamCount(candidate);t++){
  putWord(tableBytes,loRom(TEAM_TABLES[0x5ef48])-tables+t*2,0xfdd0+(t-42)*31);
  let dest=0xfa42+(t-42)*128;
  for(const [table,n] of palettes){const pointer=teamPointer(current,table,t);putWord(tableBytes,loRom(TEAM_TABLES[table])-tables+t*2,pointer?dest:0);dest+=2+n*2;}
 }
 changes.push(patch('teams:tables',tables,tableBytes));
 const namePointers=current.slice(0x38138,0x38138+86);
 for(let t=0;t<36;t++)putWord(namePointers,t*2,teamExists(candidate,t)?0x818e+t*160:0xfe88);
 changes.push(patch('teams:native-name-pointers',0x38138,namePointers));
 const names=copyNames(current,fallback);changes.push(patch(`teams:fallback:${FALLBACK_NAMES}`,loRom(FALLBACK_NAMES),names),patch(`teams:fallback:${PHYSICAL_FALLBACK_NAMES}`,loRom(PHYSICAL_FALLBACK_NAMES),names));
 const photoBytes=current.slice(photos,photos+735);
 for(const [old,next,step] of TEAM_PHOTO_TABLES)for(let t=0;t<49;t++){
  const mapped=t===48?0:teamExists(candidate,t)?t:fallback;
  const source=loRom(old)+(mapped<42?mapped:0)*step;
  photoBytes.set(current.slice(source,source+step),loRom(next)-photos+t*step);
 }
 changes.push(patch('teams:photo-tables',photos,photoBytes));
 // Only live teams are preloaded: erased graphics are never decompressed.
 const flagScript=blank(580),labelScript=blank(292);flagScript.set([1,0]);labelScript.set([1,0]);
 ids.forEach((t,i)=>{
  const dest=t<2?0x4400+t*192:selectionFlagAddress(t);
  for(let part=0;part<2;part++){const src=0xb0ca40+(t*2+part)*FLAG_SLOT;flagScript.set([...(Uint8Array.of((dest+part*96)&255,(dest+part*96)>>>8)),0x7f,src&255,src>>>8&255,0xb0],2+(i*2+part)*6);}
  const src=0xafdf00+t*LABEL_SLOT;labelScript.set([t*64&255,t*64>>>8,0x7f,src&255,src>>>8&255,0xaf],2+i*6);
 });
 changes.push(patch('flags:select-script',loRom(0x82fb5d),flagScript.slice(0,508)),patch('teams:flag-script-tail',loRom(0x82fb5d)+508,flagScript.slice(508)),patch('teams:label-script',loRom(0x82fda1),labelScript),...extraTeamCodePatches(original,candidate));
 return changes;
}

// Return exact physical allocations no remaining native team owns. Shared
// palette/formation/graphic records survive until their final owner is removed.
export function erasedNativeResources(rom,nativeRom=rom){
 if(!hasPhysicalTeams(rom)||hasExpandedTeams(rom))return [];
 const removed=Array.from({length:42},(_,t)=>t).filter(t=>!teamExists(rom,t)),live=activeTeamIds(rom),nativeLive=live.filter(t=>t<42),out=[];
 const livePalettes=[...live,48].flatMap(t=>palettes.flatMap(([table,n])=>{const pointer=teamPointer(rom,table,t);return pointer?[[loRom(0x890000|pointer)+2,n*2]]:[];}));
 for(const t of removed){
  const n=slotName(t);for(let i=0;i<20;i++)out.push([n+i*8,8,0],[attributeOffset(rom,t,i),7,0]);
  const f=slotFormation(rom,t);if(!live.some(u=>loRom(0x8b0000|teamPointer(rom,0x5ef48,u))===f))out.push([f,31,0]);
  for(const [table,count] of palettes){const pointer=word(rom,table+t*2);if(pointer){const off=loRom(0x890000|pointer)+2;if(!livePalettes.some(([p,n])=>off<p+n&&p<off+count*2))out.push([off,count*2,0]);}}
  const detail=word(rom,0xce8a+t*2);if(loRom(0x980000|detail)!==SHARED_BLANK_DETAIL&&!live.some(u=>teamPointer(rom,0xce8a,u)===detail))out.push([loRom(0x980000|detail),32,0]);
  for(const [table,bank,parts] of nativeGraphicTables(nativeRom))for(let part=0;part<parts;part++){
   const ptr=word(nativeRom,table+t*parts*2+part*2);
   if(!nativeLive.some(u=>Array.from({length:parts},(_,i)=>word(nativeRom,table+u*parts*2+i*2)).includes(ptr))){const off=loRom(bank<<16|ptr);out.push([off,bank===0xaf&&table===0xe730?FLAG_SLOT:word(nativeRom,off)&0x7fff,2]);}
  }
 }
 return [...new Map(out.map(r=>[r[0],r])).values()];
}

function erasurePatches(original,current){
 const changes=[],layout=labelLayout(current);
 const flagBytes=current.slice(flags,flags+48*2*FLAG_SLOT);
 for(let t=0;t<48;t++)if(!teamExists(current,t)){
  flagBytes.fill(255,t*2*FLAG_SLOT,(t+1)*2*FLAG_SLOT);
  changes.push(patch(`teams:label:${t}`,LABEL_POOL+t*LABEL_SLOT,blank(LABEL_SLOT)));frameCopy(layout,t);
  if(t>=42){
   for(let i=0;i<20;i++)changes.push(patch(`name:${slotName(t)+i*8}`,slotName(t)+i*8,blank(8)),patch(`attributes:${attributeOffset(current,t,i)}`,attributeOffset(current,t,i),blank(7)));
   const f=slotFormation(current,t);changes.push(patch(`formation:${f}`,f,blank(31)));
   let p=loRom(0x89fa42)+(t-42)*128;for(const [,n] of palettes){changes.push(patch(`teams:palette-header:${p}`,p,blank(2)));for(let i=0;i<n;i++)changes.push(patch(`palette:${p+2+i*2}`,p+2+i*2,blank(2)));p+=2+n*2;}
  }
 }
 changes.push(patch('teams:flags',flags,flagBytes),labelLayoutPatch(original,layout,true));
 // The registry belongs to the project base. Flag edits may have relocated
 // graphics during this session; those pools are replaced by team storage.
 for(const [off,n,header] of erasedNativeResources(current,original)){
  if(header){const bytes=current.slice(off,off+n);bytes.fill(255,header);changes.push(patch(`native-storage:${off}`,off,bytes));continue;}
  const resources=physicalTeamResources(current).filter(r=>r[1]>=off&&r[1]+r[2]<=off+n);
  for(const [id,p,size] of resources)changes.push(patch(id,p,blank(size)));
 }
 // The old OAM block remains in the ROM after relocation. Erase its removed
 // frames as well, so no obsolete copy of a deleted team label survives.
 const unexpanded=current.slice();unexpanded.fill(255,TEAM_METADATA,TEAM_METADATA+4);
 const old=labelLayout(unexpanded);for(let t=0;t<42;t++)if(!teamExists(current,t))frameCopy(old,t);
 changes.push(labelLayoutPatch(original,old,false));
 return changes;
}

export function deleteTeamPatches(original,current,team){
 if(!teamExists(current,team))throw new Error('Equipo inválido.');
 if(activeTeamIds(current).length<=1)throw new Error('Debe quedar al menos un equipo en la ROM.');
 const changes=new Map(),candidate=current.slice(),put=p=>{changes.set(p.id,p);candidate.set(p.bytes,p.offset);};
 const groups=editableGroups(current);let count=teamCount(current);
 if(!hasExtraTeams(current)){
  addTeamPatches(original,current,'TEMP').forEach(put);count=42;
 }
 if(!hasPhysicalTeams(current)){
  for(const [a,n] of [[PHYSICAL_STAR_NAMES,960],[PHYSICAL_FALLBACK_NAMES,160],[FALLBACK_NAMES,160],[COMPACT_GLYPH_ATLAS,COMPACT_GLYPH_ATLAS_SIZE]])if(!current.slice(loRom(a),loRom(a)+n).every(v=>v===255))throw new Error('El espacio para la eliminación física está ocupado.');
  put(patch('teams:compact-font',loRom(COMPACT_GLYPH_ATLAS),compactGlyphAtlas(original)));
  for(let t=36;t<42;t++)for(let i=0;i<20;i++){const off=slotName(t)+i*8;put(patch(`name:${off}`,off,copyNames(current,t).slice(i*8,i*8+8)));}
 }
 const metadata=new Uint8Array(256);metadata.set(candidate.slice(TEAM_METADATA,TEAM_METADATA+14));metadata[4]=2;metadata[5]=count;
 if(team<42)metadata[8+(team>>>3)]|=1<<(team&7);else metadata[5]=count-1;
 put(patch('teams:metadata',TEAM_METADATA,metadata));
 if(team>=42){
  // Compact independent squads and move every resource, keeping native IDs.
  const layout=labelLayout(candidate),flagBytes=candidate.slice(flags,flags+48*2*FLAG_SLOT),tableBytes=candidate.slice(tables,tables+0x640);
  for(let t=team;t<count-1;t++){
   for(let i=0;i<20;i++){put(patch(`name:${slotName(t)+i*8}`,slotName(t)+i*8,current.slice(slotName(t+1)+i*8,slotName(t+1)+i*8+8)));put(patch(`attributes:${attributeOffset(candidate,t,i)}`,attributeOffset(candidate,t,i),current.slice(attributeOffset(current,t+1,i),attributeOffset(current,t+1,i)+7)));}
   const f=slotFormation(candidate,t),src=slotFormation(current,t+1);put(patch(`formation:${f}`,f,current.slice(src,src+31)));
   let dest=loRom(0x89fa42)+(t-42)*128,source=dest+128;
   for(const [table,n] of palettes){const offset=loRom(TEAM_TABLES[table])-tables+t*2;putWord(tableBytes,offset,teamPointer(current,table,t+1)?(dest&0x7fff)|0x8000:0);put(patch(`teams:palette-header:${dest}`,dest,current.slice(source,source+2)));for(let i=0;i<n;i++)put(patch(`palette:${dest+2+i*2}`,dest+2+i*2,current.slice(source+2+i*2,source+4+i*2)));dest+=2+n*2;source+=2+n*2;}
   flagBytes.set(current.slice(flags+(t+1)*2*FLAG_SLOT,flags+(t+2)*2*FLAG_SLOT),t*2*FLAG_SLOT);
   put(patch(`teams:label:${t}`,LABEL_POOL+t*LABEL_SLOT,current.slice(LABEL_POOL+(t+1)*LABEL_SLOT,LABEL_POOL+(t+2)*LABEL_SLOT)));frameCopy(layout,t,t+1);
  }
  put(patch('teams:tables',tables,tableBytes));put(patch('teams:flags',flags,flagBytes));put(labelLayoutPatch(original,layout,true));
 }
 structuralPatches(original,candidate).forEach(put);
 const remap=t=>t===team?null:team>=42&&t>team?t-1:t;
 const nextGroups=groups.map(g=>({...g,teams:g.teams.map(remap).filter(t=>t!==null)}));
 if(!nextGroups.some(g=>g.teams.length))nextGroups[0].teams.push(activeTeamIds(candidate)[0]);
 const groupContext=candidate.slice();groupContext[TEAM_METADATA+5]=hasExtraTeams(current)?teamCount(current):43;
 editGroupsPatches(original,groupContext,nextGroups).forEach(put);
 const fallback=activeTeamIds(candidate)[0];
 for(const s of readScenarios(candidate)){
  const update={};for(const key of ['playerTeam','opponentTeam']){const mapped=remap(s[key]);if(mapped!==s[key])update[key]=mapped??fallback;}
  if(Object.keys(update).length)put(scenarioPatch(candidate,s.index,update));
 }
 const country=activeTeamIds(candidate).find(t=>t<36)??0;
 for(let i=0;i<6;i++){const off=loRom(0xa4f64f)+i*80,bytes=candidate.slice(off,off+80);for(let p=0;p<20;p++)if(!teamExists(candidate,word(bytes,p*4)/2))putWord(bytes,p*4,country*2);put(patch(`teams:star-references:${i}`,off,bytes));}
 erasurePatches(original,candidate).forEach(put);
 independentStadiumLabelPatches(original,candidate).forEach(put);
 changes.delete('teams:read:a4a046');
 return [...changes.values()];
}

export function emptyTeamPatches(original,current){
 if(hasEmptyTeams(current))return [];
 const candidate=current.slice(),changes=new Map();
 const put=p=>{changes.set(p.id,p);candidate.set(p.bytes,p.offset);};
 // Initialize physical storage once, then erase native slots in one pass.
 // A single hidden seed lets an exported draft create its first squad.
 const seed=activeTeamIds(current)[0];
 if(!hasPhysicalTeams(candidate))deleteTeamPatches(original,candidate,activeTeamIds(candidate).at(-1)).forEach(put);
 for(let t=teamCount(candidate)-1;t>=42;t--)if(t!==seed)deleteTeamPatches(original,candidate,t).forEach(put);
 const metadata=candidate.slice(TEAM_METADATA,TEAM_METADATA+256);
 metadata.fill(255,8,13);metadata[13]=3;
 if(seed<42)metadata[8+(seed>>>3)]&=~(1<<(seed&7));
 put(patch('teams:metadata',TEAM_METADATA,metadata));
 structuralPatches(original,candidate).forEach(put);
 editGroupsPatches(original,candidate,[{name:'EXTRA',teams:[seed]}]).forEach(put);
 for(const s of readScenarios(candidate))put(scenarioPatch(candidate,s.index,{playerTeam:seed,opponentTeam:seed}));
 const country=seed<36?seed:0;
 for(let i=0;i<6;i++){
  const off=loRom(0xa4f64f)+i*80,bytes=candidate.slice(off,off+80);
  for(let p=0;p<20;p++)if(!teamExists(candidate,word(bytes,p*4)/2))putWord(bytes,p*4,country*2);
  put(patch(`teams:star-references:${i}`,off,bytes));
 }
 erasurePatches(original,candidate).forEach(put);
 independentStadiumLabelPatches(original,candidate).forEach(put);
 changes.delete('teams:read:a4a046');
 const empty=candidate.slice(TEAM_METADATA,TEAM_METADATA+256);empty[6]=1;empty[7]=1;
 put(patch('teams:metadata',TEAM_METADATA,empty));
 return [...changes.values()];
}

export function firstTeamPatches(original,current,name){
 name=name.trim().toUpperCase();if(!/^[A-Z][A-Z .]{0,9}$/.test(name))throw new Error('El equipo admite hasta 10 letras A–Z, puntos y espacios.');
 const candidate=teamDataRom(current).slice(),team=activeTeamIds(candidate)[0];
 candidate[TEAM_METADATA+7]=1;
 const changes=new Map(),put=p=>{changes.set(p.id,p);candidate.set(p.bytes,p.offset);};
 put(patch('teams:metadata',TEAM_METADATA,candidate.slice(TEAM_METADATA,TEAM_METADATA+256)));
 // Choose a frame that can actually render the requested name.
 const nativeOriginal=teamDataRom(original);
 const compatible=compatibleTeamLabelSlot(nativeOriginal,candidate,[team],name.trim().toUpperCase());
 if(compatible===undefined||compatible===null){
  const added=addPhysicalTeamPatches(nativeOriginal,candidate,name);added.patches.forEach(put);
  deleteTeamPatches(nativeOriginal,candidate,team).forEach(put);
 }else{
  smallTeamNamePatches(nativeOriginal,candidate,team,name).forEach(put);
  bigTeamNamePatches(nativeOriginal,candidate,team,name).forEach(put);
  editGroupsPatches(nativeOriginal,candidate,[{name:'EXTRA',teams:[team]}]).forEach(put);
 }
 for(const id of activeTeamIds(candidate))whiteFlagPatches(nativeOriginal,candidate,id).forEach(put);
 return [...changes.values()];
}

export function addPhysicalTeamPatches(original,current,name){
 name=name.trim().toUpperCase();if(!/^[A-Z][A-Z .]{0,9}$/.test(name))throw new Error('El equipo admite hasta 10 letras A–Z, puntos y espacios.');
 const live=activeTeamIds(current);if(live.length>=48)throw new Error('Se permiten hasta 48 equipos.');
 const vacant=Array.from({length:42},(_,i)=>i).filter(i=>!teamExists(current,i));
 // Native frames have different sprite budgets. Reuse the first one that
 // can render this name, or use an additional frame while one is available.
 const team=compatibleTeamLabelSlot(original,current,vacant,name)??(teamCount(current)<48?teamCount(current):vacant[0]),source=teamExists(current,0)?0:live[0];
 const changes=new Map(),candidate=current.slice(),put=p=>{changes.set(p.id,p);candidate.set(p.bytes,p.offset);};
 const names=copyNames(current,source),attrs=current.slice(attributeOffset(current,source),attributeOffset(current,source)+140),formation=current.slice(loRom(0x8b0000|teamPointer(current,0x5ef48,source)),loRom(0x8b0000|teamPointer(current,0x5ef48,source))+31);
 const metadata=current.slice(TEAM_METADATA,TEAM_METADATA+256);if(team<42)metadata[8+(team>>>3)]&=~(1<<(team&7));else metadata[5]=team+1;
 put(patch('teams:metadata',TEAM_METADATA,metadata));
 for(let i=0;i<20;i++){put(patch(`name:${slotName(team)+i*8}`,slotName(team)+i*8,names.slice(i*8,i*8+8)));put(patch(`attributes:${attributeOffset(candidate,team,i)}`,attributeOffset(candidate,team,i),attrs.slice(i*7,i*7+7)));}
 const f=slotFormation(candidate,team);put(patch(`formation:${f}`,f,formation));
 const tableBytes=candidate.slice(tables,tables+0x640);
 let dest=loRom(0x89fa42)+(team-42)*128;
 for(const [table,n] of palettes){
  const srcPointer=teamPointer(current,table,source),pointer=team<42?word(current,table+team*2):srcPointer?((dest&0x7fff)|0x8000):0;
  putWord(tableBytes,loRom(TEAM_TABLES[table])-tables+team*2,pointer);
  if(pointer||team>=42){
   const off=team>=42?dest:loRom(0x890000|pointer),shared=pointer&&[...live,48].some(t=>palettes.some(([other,count])=>{const p=teamPointer(current,other,t);if(!p)return false;const base=loRom(0x890000|p)+2;return off+2<base+count*2&&base<off+2+n*2;}));
   // Reused native records can be shared; preserve other squads' colors.
   if(!shared){
    const bytes=srcPointer?current.slice(loRom(0x890000|srcPointer),loRom(0x890000|srcPointer)+2+n*2):new Uint8Array(2+n*2);bytes.set([n*2-1,0]);
    if(team>=42)put(patch(`teams:palette-header:${off}`,off,bytes.slice(0,2)));
    for(let i=0;i<n;i++)put(patch(`palette:${off+2+i*2}`,off+2+i*2,bytes.slice(2+i*2,4+i*2)));
   }
  }
  dest+=2+n*2;
 }
 if(team<42){
  for(const table of [0xce8a,0x1042e,0x10459,0x104af,0x1759a,0x17829]){const step=stride(table),offset=loRom(TEAM_TABLES[table])-tables+team*step;tableBytes.set(current.slice(table+team*step,table+(team+1)*step),offset);}
  const detail=loRom(0x980000|word(current,0xce8a+team*2));
  if(detail!==SHARED_BLANK_DETAIL&&!live.some(t=>teamPointer(current,0xce8a,t)===word(current,0xce8a+team*2))){const src=loRom(0x980000|teamPointer(current,0xce8a,source));put(patch(`detail:${detail}`,detail,current.slice(src,src+32)));}
 }
 const layout=labelLayout(candidate),frame=labelFrame(layout,team);let sum=0;for(let i=0;i<frame.frame;i++)sum+=layout.data[3+i];putWord(tableBytes,loRom(TEAM_TABLES[0x1759a])-tables+team*2,0x4f02+sum*2);
 putWord(tableBytes,loRom(TEAM_TABLES[0x17829])-tables+team*2,team<2?0x4400+team*192:selectionFlagAddress(team));
 put(patch('teams:tables',tables,tableBytes));
 const flagBytes=candidate.slice(flags,flags+48*2*FLAG_SLOT),matrix=flagMatrix(current,source);
 for(let i=0;i<2;i++){const encoded=compress(encodeTiles(matrix.slice(i*8,i*8+8),4));flagBytes.fill(255,(team*2+i)*FLAG_SLOT,(team*2+i+1)*FLAG_SLOT);flagBytes.set(encoded,(team*2+i)*FLAG_SLOT);}
 put(patch('teams:flags',flags,flagBytes));
 const small=blank(LABEL_SLOT);small.set(compress(encodeTiles(smallLabelMatrix(current,source),2)));put(patch(`teams:label:${team}`,LABEL_POOL+team*LABEL_SLOT,small));
 structuralPatches(original,candidate).forEach(put);
 smallTeamNamePatches(original,candidate,team,name).forEach(put);bigTeamNamePatches(original,candidate,team,name).forEach(put);
 const groups=editableGroups(candidate);let extra=groups.find(g=>g.name==='EXTRA');if(!extra){if(groups.length>=16)throw new Error('Libera un grupo para agregar equipos.');extra={name:'EXTRA',teams:[]};groups.push(extra);}extra.teams.push(team);
 editGroupsPatches(original,candidate,groups).forEach(put);
 if(current[TEAM_METADATA+7]===1)whiteFlagPatches(original,candidate,team).forEach(put);
 return {team,patches:[...changes.values()]};
}

export function validatePhysicalTeams(rom,original){
 if(hasEmptyTeams(rom)){
  const seed=teamDataRom(rom);if(activeTeamIds(seed).length!==1)throw new Error('Plantilla de ROM vacía inválida.');
  return validatePhysicalTeams(seed,teamDataRom(original));
 }
 original=teamDataRom(original);
 const ids=activeTeamIds(rom);if(!ids.length||rom[TEAM_METADATA+6]||rom[TEAM_METADATA+7]>1||(rom[TEAM_METADATA+13]&0xfc)||rom.slice(TEAM_METADATA+210,TEAM_METADATA+256).some(Boolean))throw new Error('Cantidad de equipos inválida.');
 const atlas=compactGlyphAtlas(original);if(atlas.some((b,i)=>rom[loRom(COMPACT_GLYPH_ATLAS)+i]!==b))throw new Error('Fuente de nombres pequeños inválida.');
 // Recompute immutable hooks, redirects, identity maps and live-only DMA.
 for(const p of structuralPatches(original,rom))if(p.bytes.some((b,i)=>rom[p.offset+i]!==b))throw new Error(`Estructura de eliminación física inválida: ${p.id}.`);
 for(const [off,n,header] of erasedNativeResources(rom))if(rom.slice(off+header,off+n).some(b=>b!==255))throw new Error('Datos de un equipo eliminado todavía presentes.');
 for(let t=0;t<48;t++)if(!teamExists(rom,t)){
  if(rom.slice(flags+t*2*FLAG_SLOT,flags+(t+1)*2*FLAG_SLOT).some(b=>b!==255)||rom.slice(LABEL_POOL+t*LABEL_SLOT,LABEL_POOL+(t+1)*LABEL_SLOT).some(b=>b!==255))throw new Error('Gráficos de un equipo eliminado todavía presentes.');
  if(t>=42){for(const [a,n] of [[slotName(t),160],[attributeOffset(rom,t),140],[slotFormation(rom,t),31],[loRom(0x89fa42)+(t-42)*128,128]])if(rom.slice(a,a+n).some(b=>b!==255))throw new Error('Datos de un equipo eliminado todavía presentes.');}
 }
 const layout=labelLayout(rom),nativeRom=rom.slice();nativeRom.fill(255,TEAM_METADATA,TEAM_METADATA+4);const native=labelLayout(nativeRom);
 for(let t=0;t<48;t++)if(!teamExists(rom,t))for(const l of t<42?[layout,native]:[layout]){const f=labelFrame(l,t);for(let p=0;p<4;p++)for(let i=0;i<f.count;i++)if(l.data[l.base+f.start+i+p*l.sprites]!==[0,4,170,10][p])throw new Error('Rótulo de un equipo eliminado todavía presente.');}
 for(const s of readScenarios(rom))if(!teamExists(rom,s.playerTeam)||!teamExists(rom,s.opponentTeam))throw new Error('Un Scenario referencia un equipo eliminado.');
 if(editableGroups(rom).some(g=>g.teams.some(t=>!teamExists(rom,t))))throw new Error('Un grupo referencia un equipo eliminado.');
 for(let t=42;t<teamCount(rom);t++){let p=loRom(0x89fa42)+(t-42)*128;for(const [,n] of palettes){if(word(rom,p)!==n*2-1)throw new Error('Registro de paleta adicional inválido.');p+=2+n*2;}}
}
