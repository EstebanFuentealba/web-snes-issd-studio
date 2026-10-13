import {EXPANDED as E,EXPANDED_TABLES as TABLES,EXPANDED_TEAMS as LIMIT,EXPANDED_ROM_SIZE,hasExpandedTeams,expandedRomBuffer,expandedFlagBuffer,expandedLabelBuffer} from './expanded-layout.mjs';
import {loRom,word,decompress} from './binary.mjs';
import {TEAM_METADATA,teamCount,teamExists,activeTeamIds,teamDataRom,teamTable,teamPointer,attributeOffset,teamPaletteOffset,hasExtraTeams,hasPhysicalTeams,COMPACT_GLYPH_ATLAS} from './team-count.mjs';
import {deluxePlayerNameOffset,deluxeText} from './deluxe.mjs';
import {FLAG_SLOT,LABEL_SLOT,flagMatrix,smallLabelMatrix,encodeTiles,compress} from './graphics.mjs';
import {labelLayout,labelFrame,extendedLabelLayout,labelLayoutPatch,compactGlyphAtlas,smallTeamNamePatches,bigTeamNamePatches,compatibleTeamLabelSlot,upgradeCompactTeamNamePatches} from './team-labels.mjs';
import {TEAM_TABLE_READS} from './team-hooks.mjs';
import {TEAM_PHOTO_TABLES} from './extra-teams.mjs';
import {editableGroups,editGroupsPatches} from './group-editor.mjs';
import {readScenarios,scenarioPatch} from './scenarios.mjs';
import {readFormation} from './formations.mjs';
const palettes=[[0x1027a,16],[0x102d0,16],[0x10326,11],[0x1037c,5],[0x103d2,1],[0xe7d8,4]];
const step=table=>table===0xe730?4:[0x1042e,0x104af].includes(table)?1:2;
const long=n=>[n&255,n>>>8&255,n>>>16&255],short=n=>long(n).slice(0,2);
const putWord=(b,o,n)=>b.set(short(n),o);
const patch=(id,address,bytes)=>({id,offset:loRom(address),bytes:Uint8Array.from(bytes),label:'Expansión · 56 equipos y nombres de 10 caracteres'});
const apply=(rom,ps)=>{for(const p of ps)rom.set(p.bytes,p.offset);};
const paletteBase=t=>loRom(E.palette)+t*128;
const formationBase=t=>loRom(0x8bfdd0)+(t-42)*31;
const tableSize=Object.entries(TABLES).reduce((n,[t])=>n+(LIMIT+1)*step(Number(t)),0);
const photos=TEAM_PHOTO_TABLES.map(([old,,stride,reads],i)=>[old,E.photos+TEAM_PHOTO_TABLES.slice(0,i).reduce((n,[,,s])=>n+(LIMIT+1)*s,0),stride,reads]);
const photoSize=photos.reduce((n,[,,s])=>n+(LIMIT+1)*s,0);
function program(legacy=false,oldNames=false){
 const b=[],labels={},fix=[];const emit=(...v)=>b.push(...v),label=n=>labels[n]=b.length,branch=(op,n)=>{emit(op,0);fix.push([b.length-1,n]);},call=n=>emit(0x22,...long(E.code+labels[n]));
 label('attributes');emit(0xda,0x38,0xe9,0,0x80,0xa2,0,0);label('attribute-loop');emit(0xc9,140,0);branch(0x90,'attribute-map');emit(0x38,0xe9,140,0,0xe8,0xe8);branch(0x80,'attribute-loop');label('attribute-map');emit(0x48,0xbf,...long(E.attributes),0x85,0,0x68,0x18,0x65,0,0xfa,0x6b);
 label('match-attributes');emit(0x18,0x69,0x74,0x7f);call('attributes');emit(0x85,0,0x6b);
 label('preview-attributes');call('attributes');emit(0x8d,0x38,0x0d,0xa9,0xc2,0,0x6b);
 label('names');emit(0xda,0xaa,0xbf,...long(E.identity),0xaa,0xbf,...long(TABLES[0x38138]),0xaa,0xa9,199,0,0x8b,0x54,0x7e,0xc4,0xab,0xfa,0x6b);
 label('both-names');emit(0xad,0xa0,0x0d,0xa0,0x78,0xd4);call('names');emit(0xad,0xa0,0x0e,0xa0,0x40,0xd5);call('names');emit(0x6b);
 label('portrait');emit(0xad,0xa0,0x0d,0xda,0xaa,0xbf,...long(E.identity),0xfa,0xc9,84,0);branch(0x90,'portrait-end');emit(0xc9,LIMIT*2,0);branch(0xb0,'portrait-challenge');emit(0xa9,0,0);branch(0x80,'portrait-end');label('portrait-challenge');emit(0xa9,84,0);label('portrait-end');emit(0xc9,72,0,0x6b);
 label('stride-pair');emit(0x85,8,0x0a,0x0a,0x18,0x65,8,0x18,0x65,0x16);if(!oldNames)emit(0xaa);emit(0x6b);
 label('stride-player');emit(0x0a,0x85,0,0x0a,0x0a,0x18,0x65,0,0x85,0,0x6b);
 label('stride-roster');emit(0x0a,0x85,0,0x0a,0x0a,0x18,0x65,0,0x18,0x65,0x16,0x6b);
 label('draw-name');for(let i=0;i<10;i++)emit(0xb9,i*2,0,0x22,...long(0x808e17));emit(0x6b);
 label('draw-roster');for(let i=0;i<10;i++)emit(0xa6,0x1a,0xbf,i*2,0,0x7f,0x22,...long(0x808e17));emit(0x6b);
 label('penalty');emit(0xa0,0x58,0x1f);const top=[0,0x2050,0x205d,0x204e,0,0x2040,0x2050,0x2035,0x204a,0],bottom=[0,0x2051,0x205e,0x204f,0,0x2041,0x2051,0x2036,0x204b,0];for(let p=0;p<2;p++)for(let i=0;i<10;i++)emit(0xa9,...short((p?bottom:top)[i]),0x99,i*2+p*20,0);emit(0x6b);
 label('label-buffer');emit(0xc9,96,0);branch(0xb0,'extra-label-buffer');emit(...Array(5).fill(0x0a),0x6b);label('extra-label-buffer');emit(0x38,0xe9,96,0,...Array(5).fill(0x0a),0x18,0x69,0,0x46,0x6b);
 // Original palette pointers are >= $8000. C1 low-half ROM mirrors let
 // relocated palettes use $1000..$2C80 without colliding with native palettes.
 label('palette-dispatch');emit(0x48,0x98,0xc9,0,0x80);branch(0x90,'expanded-palette');emit(0x68,0x29,0xfe,0,0xaa,0xbd,0x76,0x91,0x5c,...long(0x80a4f6));label('expanded-palette');emit(0x68);
 emit(0x29,0xfe,0,0xaa,0xbd,0x76,0x91,0x48,0x98,0x4a,0xb0,0x11,0xf4,0xc1,0,0xab,0x28,0xb9,0,0,0xbb,0xe8,0xe8,0x7a,0x54,0x7e,0xc1,0x80,0x0f,0xf4,0xc1,0,0xab,0x28,0xb9,0,0,0xbb,0xe8,0xe8,0x7a,0x54,0x7e,0xc1,0x7a,0xfa,0xab,0x6b);
 // The 2 MiB decoder masks bank bit $40 and uses it as a script flag.
 // Preserve that legacy convention except for our owned compressed pools.
 // This entry runs with an 8-bit accumulator and 16-bit X/Y.
 if(!legacy){
  label('decompress-bank');emit(0xbc,0,0,0xbd,2,0,0xc9,0xc5);branch(0xf0,'decompress-flags');emit(0xc9,0xc6);branch(0xf0,'decompress-labels');emit(0xc9,0xc8);branch(0xd0,'decompress-legacy');emit(0xc0,...short(E.bigLabels&65535));branch(0x90,'decompress-legacy');emit(0xc0,...short((E.bigLabels&65535)+E.bigCapacity));branch(0xb0,'decompress-legacy');branch(0x80,'decompress-expanded');
  label('decompress-flags');emit(0xc0,0,0x80);branch(0x90,'decompress-legacy');emit(0xc0,...short(0x8000+LIMIT*2*FLAG_SLOT));branch(0xb0,'decompress-legacy');branch(0x80,'decompress-expanded');
  label('decompress-labels');emit(0xc0,0,0x80);branch(0x90,'decompress-legacy');emit(0xc0,...short(0x8000+LIMIT*LABEL_SLOT));branch(0xb0,'decompress-legacy');
  label('decompress-expanded');emit(0x85,0x0c,0xc8,0xb7,0x0a,0x29,0x80,0x85,5,0x88,0x6b);
  label('decompress-legacy');emit(0x29,0xbf,0x85,0x0c,0xc8,0xb7,0x0a,0x29,0x80,0x85,5,0xbd,2,0,0x29,0x40,0x04,5,0x88,0x6b);
 }
 for(const [o,n] of fix){const d=labels[n]-o-1;if(d< -128||d>127)throw new Error('Salto de expansión fuera de rango.');b[o]=d&255;}
 const bytes=new Uint8Array(4096).fill(0xea);bytes.set(b);return {bytes,addresses:Object.fromEntries(Object.entries(labels).map(([n,p])=>[n,E.code+p]))};
}
const engineSpecs=[[0x83c6bd,5,'match-attributes'],[0x98f82a,6,'preview-attributes'],[0xa49c89,6,'names'],[0xa4bfc8,6,'portrait'],[0xa4bff6,6,'portrait'],[0x80cf2a,70,'both-names'],[0x80cbaf,6,'stride-pair'],[0x80cdf5,5,'stride-roster'],[0x859c6e,5,'stride-player'],[0x80cbe0,60,'draw-name'],[0x859b9e,80,'draw-roster'],[0x80ce87,99,'penalty'],[0x85af50,9,'label-buffer'],[0x85a8e3,9,'label-buffer'],[0x80a4ef,7,'palette-dispatch'],[0x80b76f,25,'decompress-bank']];
const immediates=[[0x85aeb0,0xc1],[0x83c6d0,0xc2],[0x81da29,0x40,0xd5],[0x80ca36,0x40,0xd5],[0x80cb3a,0x40,0xd5],[0x80cde6,0x40,0xd5],[0x80c9c2,0x58,0x1f],[0x80c9d8,10],[0x80c9cd,0x2c],[0x80cbc8,0x58,0x1f],[0x80cbcd,10],[0x80cc45,20],[0x80ce14,0x58,0x1f],[0x80ce19,10],[0x80cb84,1],[0x80cb8c,0x15],[0x80cb97,20],[0x859a45,10]];
const challengeHooks=[[0x85a5f3,0xc9,114],[0x85a605,0xc9,114],[0x85dc64,0xc9,114],[0x8bbf86,0xc9,112],[0x8bcfcc,0x69,114],[0x8bd024,0x69,114],[0xa4d798,0xa0,112]];
const smallFrames=[[0x828e47,2],[0x8296bd,2],[0x82f576,12],[0x8ad44c,16],[0x86c64e,3],[0x86c66d,3],[0x86c68c,3],[0x86c6ab,3],[0x8bcdad,3]];
export function expandedEnginePatches(rom,oldNames=false){
 const c=program(false,oldNames),out=[patch('teams56:code',E.code,c.bytes)],hook=(a,n,name,jump=false)=>{const b=new Uint8Array(n).fill(0xea);b.set([jump?0x5c:0x22,...long(c.addresses[name])]);return b;};
 for(const [a,n,name] of engineSpecs){const b=hook(a,n,name,[0xa49c89,0x80cf2a,0x80a4ef].includes(a));if(a===0x80cbe0)b.set([0x5c,...long(0x808e22)],4);if(a===0x859b9e)b[4]=0x60;if(a===0x80ce87)b.set([0x4c,0x75,0xce],4);out.push(patch(`teams56:hook:${a.toString(16)}`,a,b));}
 for(const [a,...bytes] of immediates)out.push(patch(`teams56:immediate:${a.toString(16)}`,a,bytes));
 // WC26 centers the 10-tile HUD names one column further left.
 out.push(patch('teams56:hud-columns',0x819471,[0xa3,0x5a,0xb3,0x5a,0x03,0x5b,0x13,0x5b,0x63,0x5b,0x73,0x5b,0xc3,0x5b,0xd3,0x5b]));
 for(const [old,reads] of Object.entries(TEAM_TABLE_READS))for(const a of reads){if([0x80cf3c,0x80cf5f,0xa49cc7].includes(a)||a===0xa4a046)continue;out.push(patch(`teams:read:${a.toString(16)}`,a,[0xbf,...long(TABLES[loRom(Number(old))])]));}
 for(const [,next,,reads] of photos)for(const [a,delta] of reads)out.push(patch(`teams:photo-read:${a.toString(16)}`,a,[0xbf,...long(next+delta)]));
 for(const [a,op,n] of challengeHooks)out.push(patch(`teams:challenge:${a.toString(16)}`,a,[op,...short(n)]));
 for(const a of [0x828c21,0x828e49,0x8296b5])out.push(patch(`teams:big-script:${a.toString(16)}`,a,[...long(E.bigLabels),2,a===0x828e49?0xcf:0x4f]));
 // 411 + 14*20 sprites end at $5468, below the next object at $557A.
 // Coordinates and tile/attribute planes keep the native $2000 separation.
 for(const [a,n] of smallFrames){const b=rom.slice(loRom(a),loRom(a)+n);if(n===2)putWord(b,0,(word(b,0)&0x8000)|0x5470);else if(n===3)putWord(b,1,({0x86c64e:0x5470,0x86c66d:0x5474,0x86c68c:0x5478,0x86c6ab:0x547c,0x8bcdad:0x5480})[a]);else for(let i=0;i<n;i+=n===16?4:2){const v=word(b,i);if(v>=0x5238&&v<0x5278)putWord(b,i,v+0x238);else if(v>=0x5330&&v<0x5370)putWord(b,i,v+0x140);}out.push(patch(`teams:small-oam:${a.toString(16)}`,a,b));}
 // Opcode $06 in these menu scripts resolves a 16-bit address in bank $82.
 out.push(patch('flags:select-entry',0x87ad9a,short(E.flagScript)),patch('teams:label-entry',0x87ad97,short(E.labelScript)));
 for(const [id,a,n,fields,bank] of [['flags:loader',0x82f7a4,23,[6,11,16,21],0xc5],['flags:match-loader',0x81e715,23,[6,11,16,21],0xc5],['flags:single-loader',0x81eb80,13,[6,11],0xc5],['labels:loader',0x81e6b4,13,[6,11],0xc6]]){const b=rom.slice(loRom(a),loRom(a)+n);for(const i of fields)b[i]=bank;out.push(patch(id,a,b));}
 return out;
}
// Repair exact engines generated by earlier v3 builds and exact legacy
// compact-name rasters, including when they are the project's ROM base.
const NATIVE_DECOMPRESS_BANK=Uint8Array.from([0xbc,0,0,0xbd,2,0,0x29,0xbf,0x85,0x0c,0xc8,0xb7,0x0a,0x29,0x80,0x85,5,0xbd,2,0,0x29,0x40,0x04,5,0x88]);
export function expandedLoaderUpgradePatches(rom){
 if(!hasExpandedTeams(rom))return [];
 const same=(bytes,at)=>bytes.every((b,i)=>rom[at+i]===b);
 const engine=expandedEnginePatches(rom),oldEngine=expandedEnginePatches(rom,true),oldHook=oldEngine.find(p=>p.id==='teams56:hook:80b76f');
 const legacy=same(program(true,true).bytes,loRom(E.code))&&same(NATIVE_DECOMPRESS_BANK,oldHook.offset),earlier=same(program(false,true).bytes,loRom(E.code))&&same(oldHook.bytes,oldHook.offset);
 const missingHandicap=same(program().bytes,loRom(E.code))&&same(Uint8Array.of(10,10,10,10,10,24,105,0,0),loRom(0x85a8e3));
 const fixes=legacy||earlier||missingHandicap?[...engine.filter(p=>p.id==='teams56:code'||p.id.startsWith('teams56:hook:')||p.id.startsWith('teams56:immediate:')),...structuralPatches(rom).filter(p=>p.id==='teams56:tables'||p.id==='teams56:flag-script')]:[];
 return [...fixes,...upgradeCompactTeamNamePatches(rom,rom)];
}
export function upgradeExpandedTeamLoader(original,patches){
 if(!hasExpandedTeams(original)&&!patches.some(p=>p.id==='teams:metadata'&&p.bytes[4]===3))return patches;
 const candidate=expandedRomBuffer(original);apply(candidate,patches);
 const fixes=expandedLoaderUpgradePatches(candidate);
 return fixes.length?[...patches.filter(p=>!fixes.some(f=>f.id===p.id)),...fixes]:patches;
}
export function expandedResources(){
 const rules=[['teams56:size',0x80ffd7,1],['teams56:tables',E.tables,tableSize],['teams56:identity',E.identity,114],['teams56:attribute-map',E.attributes,114],['teams56:flags',E.flags,LIMIT*2*FLAG_SLOT],['teams56:big-labels',E.bigLabels,E.bigCapacity],['teams56:photos',E.photos,photoSize],['teams56:flag-script',E.flagScript,676],['teams56:label-script',E.labelScript,340],['teams56:code',E.code,4096]];
 for(const [a,n] of engineSpecs)rules.push([`teams56:hook:${a.toString(16)}`,a,n]);for(const [a,...b] of immediates)rules.push([`teams56:immediate:${a.toString(16)}`,a,b.length]);rules.push(['teams56:hud-columns',0x819471,16]);
 const out=rules.map(([id,a,n])=>[id,loRom(a),n,'expanded-storage']);
 for(let t=0;t<=LIMIT;t++){
  for(let p=0;p<20;p++){const n=loRom(E.names)+t*200+p*10,a=loRom(0xc28000)+t*140+p*7;out.push([`name:${n}`,n,10,'name'],[`attributes:${a}`,a,7,'attributes']);}
  let dest=paletteBase(t);for(const [,n] of palettes){out.push([`teams56:palette-header:${dest}`,dest,2,'expanded-storage']);for(let i=0;i<n;i++)out.push([`palette:${dest+2+i*2}`,dest+2+i*2,2,'palette']);dest+=2+n*2;}
  if(t>=42&&t<LIMIT){const f=formationBase(t);out.push([`formation:${f}`,f,31,'formation']);}
  if(t<LIMIT)out.push([`teams56:label:${t}`,loRom(E.labels)+t*LABEL_SLOT,LABEL_SLOT,'expanded-storage']);
 }
 return out;
}
function structuralPatches(current){
 const live=activeTeamIds(current),fallback=live[0];if(fallback===undefined)throw new Error('Debe quedar al menos un equipo en la ROM.');
 const identity=new Uint8Array(114),attrs=new Uint8Array(114),tables=current.slice(loRom(E.tables),loRom(E.tables)+tableSize),photo=new Uint8Array(photoSize);
 for(let t=0;t<=LIMIT;t++){
  const mapped=t===LIMIT?LIMIT:teamExists(current,t)?t:fallback;putWord(identity,t*2,mapped*2);putWord(attrs,t*2,0x8000+mapped*140);
  for(const [key,address] of Object.entries(TABLES)){const table=Number(key),s=step(table),o=loRom(address)-loRom(E.tables)+t*s;
   if(t===LIMIT)continue;
   if(!teamExists(current,t)){const src=loRom(address)-loRom(E.tables)+fallback*s;tables.set(tables.slice(src,src+s),o);}
   else if(table===0x38138)putWord(tables,o,0x8000+t*200);
   if(teamExists(current,t)&&table===0x17829)putWord(tables,o,expandedFlagBuffer(t));
  }
  for(const [old,next,s] of photos){const src=loRom(old)+(mapped<42?mapped:0)*s;photo.set(current.slice(src,src+s),next-E.photos+t*s);}
 }
 const flagScript=new Uint8Array(676).fill(255),labelScript=new Uint8Array(340).fill(255);flagScript.set([1,0]);labelScript.set([1,0]);
 live.forEach((t,i)=>{for(let part=0;part<2;part++)flagScript.set([...short(expandedFlagBuffer(t)+part*96),0x7f,...long(E.flags+(t*2+part)*FLAG_SLOT)],2+(i*2+part)*6);labelScript.set([...short(expandedLabelBuffer(t)),0x7f,...long(E.labels+t*LABEL_SLOT)],2+i*6);});
 return [patch('teams56:tables',E.tables,tables),patch('teams56:identity',E.identity,identity),patch('teams56:attribute-map',E.attributes,attrs),patch('teams56:photos',E.photos,photo),patch('teams56:flag-script',E.flagScript,flagScript),patch('teams56:label-script',E.labelScript,labelScript)];
}
export function expandTeamPatches(original,current){
 if(hasExpandedTeams(current))return [];
 if(current.length!==0x200000)throw new Error('La expansión requiere una ROM ISS Deluxe de 2 MiB.');
 const source=teamDataRom(current),live=activeTeamIds(source),fallback=live[0],candidate=expandedRomBuffer(current),out=[];
 // Original-bank scratch allocations must be either free or owned by a
 // verified legacy TEAM layout. Never overwrite an unrelated hack payload.
 const free=(address,n)=>{if(!source.slice(loRom(address),loRom(address)+n).every(b=>b===255))throw new Error('El espacio para la expansión está ocupado.');};
 if(!hasExtraTeams(source))free(0xb0fe00,256);
 if(!hasPhysicalTeams(source))free(COMPACT_GLYPH_ATLAS,260);
 free(hasExtraTeams(source)?0x8bfe8a:0x8bfdd0,hasExtraTeams(source)?248:434);
 if(fallback===undefined)throw new Error('No hay un plantel base para la expansión.');
 const meta=new Uint8Array(256);meta.set([84,69,65,77,3,teamCount(current),current[TEAM_METADATA+6]===1?1:0,current[TEAM_METADATA+7]===1?1:0]);for(let t=0;t<LIMIT;t++)if(!teamExists(source,t))meta[8+(t>>>3)]|=1<<(t&7);
 const put=p=>{out.push(p);candidate.set(p.bytes,p.offset);};put(patch('teams:metadata',0xb0fe00,meta));put(patch('teams56:size',0x80ffd7,[12]));
 const atlas=compactGlyphAtlas(source);put(patch('teams:compact-font',COMPACT_GLYPH_ATLAS,atlas));
 const tables=new Uint8Array(tableSize),flags=new Uint8Array(LIMIT*2*FLAG_SLOT).fill(255);
 const layout=extendedLabelLayout(labelLayout(source),LIMIT);
 for(let t=0;t<=LIMIT;t++){
  const src=t===LIMIT?fallback:teamExists(source,t)?t:fallback;
  for(const [key,address] of Object.entries(TABLES)){const table=Number(key),s=step(table),o=loRom(address)-loRom(E.tables)+t*s,old=teamTable(source,table)+src*s;tables.set(source.slice(old,old+s),o);
   if(table===0x38138)putWord(tables,o,0x8000+t*200);
   if(table===0xe730){putWord(tables,o,0x8000+t*2*FLAG_SLOT);putWord(tables,o+2,0x8000+(t*2+1)*FLAG_SLOT);}
   if(table===0xe6c1)putWord(tables,o,0x8000+t*LABEL_SLOT);
   if(table===0x17829)putWord(tables,o,expandedFlagBuffer(t));
   if(table===0x5ef48&&t>=42&&t<LIMIT)putWord(tables,o,0xfdd0+(t-42)*31);
   if(t===LIMIT&&[0xe7d8,0x1027a,0x102d0,0x10326,0x1037c,0x103d2,0x5ef48].includes(table)){const pseudo=word(source,teamTable(source,table)+(hasExpandedTeams(source)?LIMIT:hasPhysicalTeams(source)||source[TEAM_METADATA+4]===1?48:42)*2);putWord(tables,o,pseudo);}
  }
  for(let p=0;p<20;p++){
   const n=loRom(E.names)+t*200+p*10,a=loRom(0xc28000)+t*140+p*7,bytes=new Uint8Array(10),off=deluxePlayerNameOffset(source,src,p);bytes.set(source.slice(off,off+8));put({id:`name:${n}`,offset:n,bytes,label:'Nombres de 10 caracteres'});
   const srcAttr=t===LIMIT?0x516f8+p*7:attributeOffset(source,src,p);put({id:`attributes:${a}`,offset:a,bytes:source.slice(srcAttr,srcAttr+7),label:'Plantel ampliado'});
  }
  let dest=paletteBase(t);for(const [table,n] of palettes){const ptr=t===LIMIT?word(source,teamTable(source,table)+(hasPhysicalTeams(source)||source[TEAM_METADATA+4]===1?48:42)*2):teamPointer(source,table,src),bytes=ptr?source.slice(teamPaletteOffset(source,ptr),teamPaletteOffset(source,ptr)+2+n*2):new Uint8Array(2+n*2);bytes.set([n*2-1,0]);putWord(tables,loRom(TABLES[table])-loRom(E.tables)+t*2,ptr?((dest&0x7fff)):0);put({id:`teams56:palette-header:${dest}`,offset:dest,bytes:bytes.slice(0,2)});for(let i=0;i<n;i++)put({id:`palette:${dest+2+i*2}`,offset:dest+2+i*2,bytes:bytes.slice(2+i*2,4+i*2)});dest+=2+n*2;}
  if(t>=42&&t<LIMIT){const f=formationBase(t);put({id:`formation:${f}`,offset:f,bytes:readFormation(source,src).bytes});}
  if(t===LIMIT)continue;
  if(!teamExists(source,t)){const f=labelFrame(layout,t);for(let p=0;p<4;p++)layout.data.fill([0,4,170,10][p],layout.base+f.start+p*layout.sprites,layout.base+f.start+f.count+p*layout.sprites);}
  for(let part=0;part<2;part++)flags.set(compress(encodeTiles(flagMatrix(source,src).slice(part*8,part*8+8),4)),(t*2+part)*FLAG_SLOT);
  const small=new Uint8Array(LABEL_SLOT).fill(255);small.set(compress(encodeTiles(smallLabelMatrix(source,src),2)));put(patch(`teams56:label:${t}`,E.labels+t*LABEL_SLOT,small));
  const frame=labelFrame(layout,t);putWord(tables,loRom(TABLES[0x1759a])-loRom(E.tables)+t*2,0x4f02+frame.start*2);
 }
 put(patch('teams56:tables',E.tables,tables));put(patch('teams56:flags',E.flags,flags));put(labelLayoutPatch(original,layout,true));
 for(const p of expandedEnginePatches(current))put(p);
 // Deleted IDs and groups still resolve to a live squad. Temporarily expose
 // the retained seed while generating structural data for an empty project.
 const context=teamDataRom(candidate);for(const p of structuralPatches(context))put(p);
 return [...new Map(out.map(p=>[p.id,p])).values()];
}
export function addExpandedTeamPatches(original,current,name){
 name=name.trim().toUpperCase();if(!/^[A-Z][A-Z .]{0,9}$/.test(name))throw new Error('El equipo admite hasta 10 letras A–Z, puntos y espacios.');
 const seed=teamDataRom(current),live=activeTeamIds(seed);if(activeTeamIds(current).length>=LIMIT)throw new Error('Se permiten hasta 56 equipos.');
 const vacant=Array.from({length:LIMIT},(_,t)=>t).filter(t=>!teamExists(current,t)),team=compatibleTeamLabelSlot(original,seed,vacant,name);if(team===undefined)throw new Error('El nombre no cabe en los espacios libres.');
 const source=live.includes(0)?0:live[0],candidate=current.slice(),changes=new Map(),put=p=>{changes.set(p.id,p);candidate.set(p.bytes,p.offset);};
 const groups=editableGroups(current),meta=current.slice(TEAM_METADATA,TEAM_METADATA+256);meta[6]=0;meta[5]=Math.max(42,meta[5],team+1);if(current[TEAM_METADATA+6]===1)meta.fill(255,8,15);meta[8+(team>>>3)]&=~(1<<(team&7));put(patch('teams:metadata',0xb0fe00,meta));
 for(let p=0;p<20;p++){const n=loRom(E.names)+team*200+p*10,src=deluxePlayerNameOffset(seed,source,p),a=attributeOffset(candidate,team,p);put({id:`name:${n}`,offset:n,bytes:seed.slice(src,src+10)});put({id:`attributes:${a}`,offset:a,bytes:seed.slice(attributeOffset(seed,source,p),attributeOffset(seed,source,p)+7)});}
 const table=candidate.slice(loRom(E.tables),loRom(E.tables)+tableSize);for(const [key,address] of Object.entries(TABLES)){const t=Number(key),s=step(t),o=loRom(address)-loRom(E.tables);table.set(seed.slice(loRom(address)+source*s,loRom(address)+(source+1)*s),o+team*s);}
 let dest=paletteBase(team),src=paletteBase(source);for(const [t,n] of palettes){putWord(table,loRom(TABLES[t])-loRom(E.tables)+team*2,teamPointer(seed,t,source)?dest&0x7fff:0);put({id:`teams56:palette-header:${dest}`,offset:dest,bytes:seed.slice(src,src+2)});for(let i=0;i<n;i++)put({id:`palette:${dest+2+i*2}`,offset:dest+2+i*2,bytes:seed.slice(src+2+i*2,src+4+i*2)});dest+=2+n*2;src+=2+n*2;}
 for(const [t,value] of [[0x38138,0x8000+team*200],[0xe6c1,0x8000+team*LABEL_SLOT],[0x17829,expandedFlagBuffer(team)],[0xe730,0x8000+team*2*FLAG_SLOT]])putWord(table,loRom(TABLES[t])-loRom(E.tables)+team*step(t),value);putWord(table,loRom(TABLES[0xe730])-loRom(E.tables)+team*4+2,0x8000+(team*2+1)*FLAG_SLOT);
 if(team>=42){putWord(table,loRom(TABLES[0x5ef48])-loRom(E.tables)+team*2,0xfdd0+(team-42)*31);const f=formationBase(team);put({id:`formation:${f}`,offset:f,bytes:readFormation(seed,source).bytes});}
 put(patch('teams56:tables',E.tables,table));const flags=candidate.slice(loRom(E.flags),loRom(E.flags)+LIMIT*2*FLAG_SLOT);flags.set(seed.slice(loRom(E.flags)+source*2*FLAG_SLOT,loRom(E.flags)+(source+1)*2*FLAG_SLOT),team*2*FLAG_SLOT);if(current[TEAM_METADATA+6]===1){const white=Array.from({length:8},()=>Array(24).fill(13)),encoded=compress(encodeTiles(white,4));flags.fill(255,team*2*FLAG_SLOT,(team+1)*2*FLAG_SLOT);for(let part=0;part<2;part++)flags.set(encoded,(team*2+part)*FLAG_SLOT);const color=paletteBase(team)+palettes.slice(0,-1).reduce((n,[,count])=>n+2+count*2,0)+4;put({id:`palette:${color}`,offset:color,bytes:Uint8Array.of(255,127)});}
 put(patch('teams56:flags',E.flags,flags));put(patch(`teams56:label:${team}`,E.labels+team*LABEL_SLOT,seed.slice(loRom(E.labels)+source*LABEL_SLOT,loRom(E.labels)+(source+1)*LABEL_SLOT)));
 // Every additional OAM slot has twenty sprites, so ten ordinary letters fit.
 const layout=labelLayout(candidate),f=labelFrame(layout,team);putWord(table,loRom(TABLES[0x1759a])-loRom(E.tables)+team*2,0x4f02+f.start*2);put(patch('teams56:tables',E.tables,table));
 smallTeamNamePatches(original,candidate,team,name).forEach(put);bigTeamNamePatches(original,candidate,team,name).forEach(put);structuralPatches(candidate).forEach(put);
 let extra=groups.find(g=>g.name==='EXTRA');if(!extra){if(groups.length===16)throw new Error('Libera un grupo para agregar equipos.');extra={name:'EXTRA',teams:[]};groups.push(extra);}extra.teams.push(team);editGroupsPatches(original,candidate,groups).forEach(put);
 return {team,patches:[...changes.values()]};
}
export function deleteExpandedTeamPatches(original,current,team){
 if(!teamExists(current,team))throw new Error('Equipo inválido.');if(activeTeamIds(current).length<=1)throw new Error('Debe quedar al menos un equipo en la ROM.');
 const candidate=current.slice(),changes=new Map(),put=p=>{changes.set(p.id,p);candidate.set(p.bytes,p.offset);},meta=current.slice(TEAM_METADATA,TEAM_METADATA+256);meta[8+(team>>>3)]|=1<<(team&7);put(patch('teams:metadata',0xb0fe00,meta));
 structuralPatches(candidate).forEach(put);
 for(let p=0;p<20;p++){const n=loRom(E.names)+team*200+p*10,a=attributeOffset(candidate,team,p);put({id:`name:${n}`,offset:n,bytes:new Uint8Array(10).fill(255)});put({id:`attributes:${a}`,offset:a,bytes:new Uint8Array(7).fill(255)});}
 let dest=paletteBase(team);for(const [,n] of palettes){put({id:`teams56:palette-header:${dest}`,offset:dest,bytes:new Uint8Array(2).fill(255)});for(let i=0;i<n;i++)put({id:`palette:${dest+2+i*2}`,offset:dest+2+i*2,bytes:new Uint8Array(2).fill(255)});dest+=2+n*2;}
 const flags=candidate.slice(loRom(E.flags),loRom(E.flags)+LIMIT*2*FLAG_SLOT);flags.fill(255,team*2*FLAG_SLOT,(team+1)*2*FLAG_SLOT);put(patch('teams56:flags',E.flags,flags));put(patch(`teams56:label:${team}`,E.labels+team*LABEL_SLOT,new Uint8Array(LABEL_SLOT).fill(255)));
 const layout=labelLayout(candidate),frame=labelFrame(layout,team);for(let p=0;p<4;p++)layout.data.fill([0,4,170,10][p],layout.base+frame.start+p*layout.sprites,layout.base+frame.start+frame.count+p*layout.sprites);put(labelLayoutPatch(original,layout,true));
 const groups=editableGroups(current).map(g=>({...g,teams:g.teams.filter(t=>t!==team)})),fallback=activeTeamIds(candidate)[0];if(!groups.some(g=>g.teams.length))groups[0].teams.push(fallback);editGroupsPatches(original,candidate,groups).forEach(put);
 for(const s of readScenarios(candidate)){const changes={};for(const k of ['playerTeam','opponentTeam'])if(s[k]===team)changes[k]=fallback;if(Object.keys(changes).length)put(scenarioPatch(candidate,s.index,changes));}
 return [...changes.values()];
}
export function validateExpandedTeams(rom){
 if(!hasExpandedTeams(rom))return;if(rom.length!==EXPANDED_ROM_SIZE||rom[0x7fd7]!==12||teamCount(rom)>LIMIT||rom[TEAM_METADATA+7]>1||rom.slice(TEAM_METADATA+15,TEAM_METADATA+256).some(Boolean))throw new Error('Expansión de equipos inválida.');
 const context=teamDataRom(rom);for(const p of structuralPatches(context))if(p.bytes.some((b,i)=>rom[p.offset+i]!==b))throw new Error(`Estructura ampliada inválida: ${p.id}.`);
 for(const p of expandedEnginePatches(rom).filter(p=>p.id.startsWith('teams56:hook:')||p.id.startsWith('teams56:immediate:')||p.id.startsWith('teams:read:')||p.id.startsWith('teams:challenge:')||p.id.startsWith('teams:photo-read:')||p.id==='teams56:hud-columns'))if(p.bytes.some((b,i)=>rom[p.offset+i]!==b))throw new Error(`Rutina ampliada inválida: ${p.id}.`);
 const c=program();if(c.bytes.some((b,i)=>rom[loRom(E.code)+i]!==b))throw new Error('Código de expansión inválido.');
 const ranges=[];for(const t of activeTeamIds(context)){
  for(const [start,size] of [[expandedFlagBuffer(t),192],[expandedLabelBuffer(t),64]]){if(ranges.some(([a,b])=>start<b&&a<start+size))throw new Error('Búferes de selección superpuestos.');ranges.push([start,start+size]);}
  for(let p=0;p<20;p++){const n=deluxeText(rom.slice(deluxePlayerNameOffset(rom,t,p),deluxePlayerNameOffset(rom,t,p)+10));if(!n||n.includes('�'))throw new Error('Nombre ampliado inválido.');}
  if(teamPointer(rom,0x38138,t)!==0x8000+t*200||teamPointer(rom,0xe730,t,4)!==0x8000+t*2*FLAG_SLOT||teamPointer(rom,0xe6c1,t)!==0x8000+t*LABEL_SLOT)throw new Error('Punteros ampliados inválidos.');
  const frame=labelFrame(labelLayout(rom),t);if(teamPointer(rom,0x1759a,t)!==0x4f02+frame.start*2||teamPointer(rom,0x17829,t)!==expandedFlagBuffer(t))throw new Error('Búfer ampliado inválido.');
  let dest=paletteBase(t);for(const [table,n] of palettes){const ptr=teamPointer(rom,table,t);if(ptr&&ptr!==(dest&0x7fff)||word(rom,dest)!==n*2-1)throw new Error('Paleta ampliada inválida.');dest+=2+n*2;}
 }
}

export function emptyExpandedTeamPatches(original,current){
 if(current[TEAM_METADATA+6]===1)return [];
 const candidate=current.slice(),changes=new Map(),put=p=>{changes.set(p.id,p);candidate.set(p.bytes,p.offset);},seed=activeTeamIds(current)[0];
 for(const t of activeTeamIds(current))if(t!==seed)deleteExpandedTeamPatches(original,candidate,t).forEach(put);
 const metadata=candidate.slice(TEAM_METADATA,TEAM_METADATA+256);metadata[6]=1;metadata[7]=1;put(patch('teams:metadata',0xb0fe00,metadata));return [...changes.values()];
}
