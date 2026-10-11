import {loRom,word,decompress} from './binary.mjs';
import {MAX_TEAMS,TEAM_METADATA,TEAM_TABLES,hasExtraTeams,hasPhysicalTeams,teamExists,activeTeamIds,IDENTITY_MAP,ATTRIBUTE_MAP,teamCount,teamTable,teamPointer,attributeOffset,EXTRA_BIG_LABEL_ADDRESS,EXTRA_BIG_LABEL_CAPACITY} from './team-count.mjs';
import {TEAM_TABLE_READS} from './team-hooks.mjs';
import {flagMatrix,smallLabelMatrix,encodeTiles,compress,FLAG_SLOT,LABEL_POOL,LABEL_SLOT,FLAG_RULES,LABEL_RULES,selectionFlagAddress,validateFlagStorage,validateSmallLabelStorage} from './graphics.mjs';
import {labelLayout,extendedLabelLayout,smallTeamNamePatches,bigTeamNamePatches,teamNameTexts} from './team-labels.mjs';
import {deluxePlayerNameOffset} from './deluxe.mjs';
import {readFormation} from './formations.mjs';
import {editGroupsPatches,editableGroups} from './group-editor.mjs';
import {validatePhysicalTeams} from './physical-teams.mjs';

const TABLE_POOL=loRom(0xb0c400),FLAG_POOL=loRom(0xb0ca40),CODE=0xb0fc40;
const paletteSpecs=[[0x1027a,16],[0x102d0,16],[0x10326,11],[0x1037c,5],[0x103d2,1],[0xe7d8,4]];
const paletteStride=128;
// The selector photograph has its own palettes, hair/skin variants and
// OAM accessories. These tables are separate from the match uniform tables.
export const TEAM_PHOTO_TABLES=[[8583325,11529216,2,[[8761283,0]]],[8583603,11529314,2,[[8761290,0]]],[8583775,11529412,2,[[8761276,0]]],[8583519,11529510,2,[[8761297,0],[8761313,1]]],[8582684,11529608,2,[[8761620,0]]],[8583409,11529706,1,[[8761651,0]]],[8583451,11529755,1,[[8761344,0]]],[8583687,11529804,1,[[8761533,0],[8761566,0]]],[8583733,11529853,1,[[8761474,0]]],[8583859,11529902,1,[[8761592,0]]]];
const PHOTO_POOL=loRom(0xafec00),PHOTO_SIZE=735;
const asBytes=n=>[n&255,n>>>8&255,n>>>16&255];
const patch=(id,offset,bytes)=>({id,offset,bytes:Uint8Array.from(bytes),label:'Equipos adicionales'});
const challengeHooks=[[0x85a5f3,0xc9,86,98],[0x85a605,0xc9,86,98],[0x85dc64,0xc9,86,98],[0x8bbf86,0xc9,84,96],[0x8bcfcc,0x69,86,98],[0x8bd024,0x69,86,98],[0xa4d798,0xa0,84,96]];
const specialHooks=[[0x83c6bd,5],[0x98f82a,6],[0xa49c89,6],[0xa4bfc8,6],[0xa4bff6,6]];
// The expanded name planes end at $5328. Move the six small UI frames
// originally at $5238..$5278 to $5330..$5370, before the next object at $557A.
// Both coordinate and attribute planes retain the native $2000 separation.
const bigScripts=[0x828c21,0x828e49,0x8296b5];
export const EXTRA_TEAM_RULES=[
 ['teams:metadata',TEAM_METADATA,256],['teams:tables',TABLE_POOL,0x640],
 ['teams:flags',FLAG_POOL,48*2*FLAG_SLOT],['teams:big-labels',loRom(EXTRA_BIG_LABEL_ADDRESS),EXTRA_BIG_LABEL_CAPACITY],
 ['teams:photo-tables',PHOTO_POOL,PHOTO_SIZE],...TEAM_PHOTO_TABLES.flatMap(([, , ,reads])=>reads.map(([a])=>[`teams:photo-read:${a.toString(16)}`,loRom(a),4])),['teams:code',loRom(CODE),448],['teams:label-script',loRom(0x82fda1),292],['teams:label-entry',loRom(0x87ad97),2],
 ...Object.values(TEAM_TABLE_READS).flat().map(a=>[`teams:read:${a.toString(16)}`,loRom(a),4]),
 ...challengeHooks.map(([a])=>[`teams:challenge:${a.toString(16)}`,loRom(a),3]),
 ...specialHooks.map(([a,n])=>[`teams:hook:${a.toString(16)}`,loRom(a),n]),
 ...bigScripts.map(a=>[`teams:big-script:${a.toString(16)}`,loRom(a),5]),
 ...[[0x828e47,2],[0x8296bd,2],[0x82f576,12],[0x8ad44c,16],[0x86c64e,3],[0x86c66d,3],[0x86c68c,3],[0x86c6ab,3],[0x8bcdad,3]].map(([a,n])=>[`teams:small-oam:${a.toString(16)}`,loRom(a),n]),
 ['teams:flag-script-tail',loRom(0x82fb5d)+508,72],
 ...Array.from({length:48},(_,i)=>[`teams:label:${i}`,LABEL_POOL+i*LABEL_SLOT,LABEL_SLOT]),
];
export function extraTeamResources(){
 const out=[];
 for(let t=42;t<48;t++){
  for(let p=0;p<20;p++){const name=loRom(0x87fac8)+(t-42)*160+p*8,attrs=loRom(0x8af558)+(t-42)*140+p*7;out.push([`name:${name}`,name,8,'name'],[`attributes:${attrs}`,attrs,7,'attributes']);}
  const offset=loRom(0x8bfdd0)+(t-42)*31;out.push([`formation:${offset}`,offset,31,'formation']);
  let p=loRom(0x89fa42)+(t-42)*paletteStride;
  for(const [,count] of paletteSpecs){out.push([`teams:palette-header:${p}`,p,2,'relocated-storage']);for(let i=0;i<count;i++)out.push([`palette:${p+2+i*2}`,p+2+i*2,2,'palette']);p+=2+count*2;}
 }
 return out;
}
function code(physical=false){
 const b=[],labels={},fix=[];const emit=(...v)=>b.push(...v),label=n=>labels[n]=b.length,branch=(op,n)=>{emit(op,0);fix.push([b.length-1,n]);};
 label('attributes');
 if(physical){
  // Preserve X and the player remainder while resolving removed native IDs.
  emit(0xda,0x38,0xe9,0,0x80,0xa2,0,0);label('attribute-id');emit(0xc9,140,0);branch(0x90,'attribute-map');emit(0x38,0xe9,140,0,0xe8,0xe8);branch(0x80,'attribute-id');label('attribute-map');emit(0x48,0xbf,...asBytes(ATTRIBUTE_MAP),0x85,0,0x68,0x18,0x65,0,0xfa,0x6b);
 }else{emit(0xc9,0xf8,0x96);branch(0x90,'attributes-done');emit(0xc9,0x40,0x9a);branch(0xb0,'attributes-challenge');emit(0x18,0x69,0x60,0x5e);branch(0x80,'attributes-done');label('attributes-challenge');emit(0x38,0xe9,0x48,3);label('attributes-done');emit(0x6b);}
 label('match-attributes');emit(0x18,0x69,0x74,0x7f,0x22,...asBytes(CODE+labels.attributes),0x85,0,0x6b);
 label('preview-attributes');emit(0x22,...asBytes(CODE+labels.attributes),0x8d,0x38,0x0d,0xa9,0x8a,0,0x6b);
 label('names');if(physical)emit(0xaa,0xbf,...asBytes(IDENTITY_MAP));emit(0xc9,96,0);branch(0x90,'normal-name-id');emit(0x38,0xe9,12,0);branch(0x80,'star-names');label('normal-name-id');
 if(physical){emit(0xc9,72,0);branch(0x90,'bank87-names');emit(0xc9,84,0);branch(0xb0,'bank87-names');emit(0xaa,0xbf,...asBytes(TEAM_TABLES[0x38138]),0xaa,0xa9,0x9f,0,0x8b,0x54,0x7e,0x8a,0xab,0x6b);label('bank87-names');}
 else{emit(0xc9,84,0);branch(0x90,'star-names');}
 emit(0xaa,0xbf,...asBytes(TEAM_TABLES[0x38138]),0xaa,0xa9,0x9f,0,0x8b,0x54,0x7e,0x87,0xab,0x6b);
 label('star-names');emit(0x84,0x12,0x38,0xe9,0x48,0,0x5c,...asBytes(0xa49c8f));
 // New squads inherit Italy's shared portrait assets. Only the six native
 // All-Star IDs may index the cartridge's special portrait tables.
 label('portrait-team');emit(0xad,0xa0,0x0d);if(physical)emit(0xda,0xaa,0xbf,...asBytes(IDENTITY_MAP),0xfa);emit(0xc9,84,0);branch(0x90,'portrait-done');emit(0xc9,96,0);branch(0xb0,'portrait-challenge');emit(0xa9,0,0);branch(0x80,'portrait-done');label('portrait-challenge');emit(0xa9,84,0);label('portrait-done');emit(0xc9,72,0,0x6b);
 for(const [p,n] of fix){const d=labels[n]-p-1;if(d< -128||d>127)throw new Error('Código de equipos fuera de rango.');b[p]=d&255;}
 const bytes=new Uint8Array(448).fill(0xea);bytes.set(b);return {bytes,addresses:Object.fromEntries(Object.entries(labels).map(([n,p])=>[n,CODE+p]))};
}
export function extraTeamCodePatches(original,current=original){
 const result=[],c=code(hasPhysicalTeams(current));result.push(patch('teams:code',loRom(CODE),c.bytes));
 for(const [old,reads] of Object.entries(TEAM_TABLE_READS)){
  const address=Number(old),table=loRom(address),next=TEAM_TABLES[table];
  for(const a of reads){const expected=Uint8Array.of(0xbf,...asBytes(address)),offset=loRom(a);if(a===0xa4a046&&[0x22,0,0xd0,0x86].every((v,i)=>current[offset+i]===v))continue;if(!hasExtraTeams(original)&&expected.some((v,i)=>v!==original[offset+i]))throw new Error('Rutina de equipos no compatible.');result.push(patch(`teams:read:${a.toString(16)}`,offset,[0xbf,...asBytes(next)]));}
 }
 for(const [old,next,,reads] of TEAM_PHOTO_TABLES)for(const [a,delta] of reads){const offset=loRom(a),expected=[0xbf,...asBytes(old+delta)];if(!hasExtraTeams(original)&&expected.some((v,i)=>v!==original[offset+i]))throw new Error('Fotografía de selección no compatible.');result.push(patch(`teams:photo-read:${a.toString(16)}`,offset,[0xbf,...asBytes(next+delta)]));}
 for(const [a,op,old,next] of challengeHooks){const offset=loRom(a);if(!hasExtraTeams(original)&&(original[offset]!==op||word(original,offset+1)!==old))throw new Error('Modo Challenge no compatible.');result.push(patch(`teams:challenge:${a.toString(16)}`,offset,[op,next,0]));}
 const targets=['match-attributes','preview-attributes','names','portrait-team','portrait-team'];
 const expected=['69747f8500','8d380da98a00','841238e94800','ada00dc94800','ada00dc94800'];
 specialHooks.forEach(([a,size],i)=>{const offset=loRom(a);if(!hasExtraTeams(original)&&Array.from(original.slice(offset,offset+size),b=>b.toString(16).padStart(2,'0')).join('')!==expected[i])throw new Error('Carga de planteles no compatible.');const bytes=new Uint8Array(size).fill(0xea);bytes.set([i===2?0x5c:0x22,...asBytes(c.addresses[targets[i]])]);result.push(patch(`teams:hook:${a.toString(16)}`,offset,bytes));});
 for(const a of bigScripts){const offset=loRom(a),flag=original[offset+4]&128;result.push(patch(`teams:big-script:${a.toString(16)}`,offset,[...asBytes(EXTRA_BIG_LABEL_ADDRESS),2,0x4f|flag]));}
 for(const [a,n] of [[0x828e47,2],[0x8296bd,2],[0x82f576,12],[0x8ad44c,16],[0x86c64e,3],[0x86c66d,3],[0x86c68c,3],[0x86c6ab,3],[0x8bcdad,3]]){
  const offset=loRom(a),bytes=original.slice(offset,offset+n);if(!hasExtraTeams(original)){
   if(n===2){const v=word(bytes,0);bytes.set(asBytes((v&0x8000)|0x5330).slice(0,2));}
   else if(n===3){const v=word(bytes,1)+0xf8;bytes.set(asBytes(v).slice(0,2),1);}
   else for(let i=0;i<n;i+=n===16?4:2){const v=word(bytes,i);if(v>=0x5238&&v<0x5278)bytes.set(asBytes(v+0xf8).slice(0,2),i);}
  }
  result.push(patch(`teams:small-oam:${a.toString(16)}`,offset,bytes));
 }
 return result;
}
function assertFree(original){
 for(const [address,size] of [[0xafec00,PHOTO_SIZE],[0xb0c400,0x3c00],[0x87fac8,960],[0x8af558,840],[0x89fa42,768],[0x8bfdd0,186]])if(!original.slice(loRom(address),loRom(address)+size).every(v=>v===255))throw new Error('El espacio para nuevos equipos está ocupado.');
 if(!original.slice(loRom(0x82fb5d)+508,loRom(0x82fb5d)+872).every(v=>v===255))throw new Error('El espacio para la precarga de equipos está ocupado.');
}
function photoTablePatch(rom){
 const bytes=new Uint8Array(PHOTO_SIZE);
 for(const [old,next,stride] of TEAM_PHOTO_TABLES){const base=loRom(next)-PHOTO_POOL;bytes.set(rom.slice(loRom(old),loRom(old)+42*stride),base);for(let t=42;t<49;t++)bytes.set(rom.slice(loRom(old),loRom(old)+stride),base+t*stride);}
 return patch('teams:photo-tables',PHOTO_POOL,bytes);
}
// Upgrade drafts produced before the selector photograph tables were expanded.
// Keep every squad/name/graphic edit; only add the missing immutable routines.
export function upgradeExtraTeamSelector(original,patches){
 if(!hasExtraTeams(original)&&patches.some(p=>p.id==='teams:metadata')&&!patches.some(p=>p.id==='teams:photo-tables')){
  if(!original.slice(PHOTO_POOL,PHOTO_POOL+PHOTO_SIZE).every(v=>v===255))throw new Error('El espacio para fotografías está ocupado.');
  const additions=[photoTablePatch(original),...extraTeamCodePatches(original).filter(p=>p.id.startsWith('teams:photo-read:')||['teams:small-oam:86c66d','teams:small-oam:86c6ab'].includes(p.id))];
  patches=[...patches.filter(p=>!additions.some(a=>a.id===p.id)),...additions];
 }
 // Re-center names in earlier drafts whose transparent padding was used as
 // the text anchor. Preserve the edited text and every other team resource.
 if(patches.some(p=>p.id==='teams:big-labels')){
  const candidate=original.slice();
  for(const p of patches){if(p.offset<0||p.offset+p.bytes.length>candidate.length)throw new Error('Recurso de equipos inválido.');candidate.set(p.bytes,p.offset);}
  for(let t=42;t<teamCount(candidate);t++){
   const text=teamNameTexts(original,candidate,t).large;
   if(!text)throw new Error('Rótulo de equipo adicional inválido.');
   const corrected=bigTeamNamePatches(original,candidate,t,text);
   for(const p of corrected)candidate.set(p.bytes,p.offset);
   patches=[...patches.filter(p=>!corrected.some(a=>a.id===p.id)),...corrected];
  }
 }
 return patches;
}
export function addTeamPatches(original,current,name){
 const count=teamCount(current);if(count>=MAX_TEAMS)throw new Error('Se permiten hasta 48 equipos.');
 name=name.trim().toUpperCase();if(!/^[A-Z][A-Z .]{0,9}$/.test(name))throw new Error('El equipo admite hasta 10 letras A–Z, puntos y espacios.');
 let changes=[];
 const candidate=current.slice();
 if(!hasExtraTeams(current)){
  assertFree(original);
  const tables=new Uint8Array(0x640).fill(0),put=(table,index,value,stride=2)=>{const p=loRom(TEAM_TABLES[table])-TABLE_POOL+index*stride;tables[p]=value&255;if(stride!==1)tables[p+1]=value>>>8;};
  for(const [key,next] of Object.entries(TEAM_TABLES)){
   const table=Number(key),stride=table===0xe730?4:[0x1042e,0x104af].includes(table)?1:2;
   const old=teamTable(current,table);
   tables.set(current.slice(old,old+42*stride),loRom(next)-TABLE_POOL);
   // Palette tables have a 43rd native entry for the Challenge pseudo-team.
   if(paletteSpecs.some(([t])=>t===table)||table===0x5ef48)put(table,48,word(current,old+84));
   for(let i=42;i<48;i++){put(table,i,stride===1?current[old]:word(current,old),stride);if(stride===4)put(table,i,word(current,old+2),4);}
  }
  changes.push(photoTablePatch(current));
  const flags=new Uint8Array(48*2*FLAG_SLOT).fill(255),labels=[];
  const layout=extendedLabelLayout(labelLayout(current)),big=compress(layout.data),bigBytes=new Uint8Array(EXTRA_BIG_LABEL_CAPACITY).fill(255);if(big.length>bigBytes.length)throw new Error('Los nombres grandes exceden el espacio disponible.');bigBytes.set(big);
  for(let i=0;i<48;i++){
   const source=i<42?i:0;
   for(let part=0;part<2;part++){const bytes=compress(encodeTiles(flagMatrix(current,source).slice(part*8,part*8+8),4));flags.set(bytes,(i*2+part)*FLAG_SLOT);const p=loRom(TEAM_TABLES[0xe730])-TABLE_POOL+i*4+part*2;tables[p]=(0xca40+(i*2+part)*FLAG_SLOT)&255;tables[p+1]=(0xca40+(i*2+part)*FLAG_SLOT)>>>8;}
   const label=compress(encodeTiles(smallLabelMatrix(current,source),2)),bytes=new Uint8Array(LABEL_SLOT).fill(255);bytes.set(label);labels.push(patch(`teams:label:${i}`,LABEL_POOL+i*LABEL_SLOT,bytes));put(0xe6c1,i,0xdf00+i*LABEL_SLOT);
   put(0x17829,i,i<2?0x4400+i*192:selectionFlagAddress(i));
   let sum=0,frame=i<42?([14,15,16,0,2,3,4,6,12,5,8,10,7,11,9,13,1,36,18,20,21,22,28,32,19,17,33,24,23,25,34,29,30,27,26,31,35,38,41,39,40,37][i]):i;for(let f=0;f<frame;f++)sum+=layout.data[3+f];put(0x1759a,i,0x4f02+sum*2);
  }
  // Preserve the original Challenge label instead of interpreting ID 48 as
  // a seventh added team.
  put(0x1759a,48,word(current,0x1759a+84));
  for(let i=42;i<48;i++){
   const nameOffset=loRom(0x87fac8)+(i-42)*160,attrs=loRom(0x8af558)+(i-42)*140,formation=loRom(0x8bfdd0)+(i-42)*31;
   put(0x38138,i,0xfac8+(i-42)*160);put(0x5ef48,i,0xfdd0+(i-42)*31);
   for(let p=0;p<20;p++){changes.push(patch(`name:${nameOffset+p*8}`,nameOffset+p*8,current.slice(deluxePlayerNameOffset(current,0,p),deluxePlayerNameOffset(current,0,p)+8)),patch(`attributes:${attrs+p*7}`,attrs+p*7,current.slice(attributeOffset(current,0,p),attributeOffset(current,0,p)+7)));}
   changes.push(patch(`formation:${formation}`,formation,readFormation(current,0).bytes));
   let dest=loRom(0x89fa42)+(i-42)*paletteStride;
   for(const [table,n] of paletteSpecs){const pointer=teamPointer(current,table,0);put(table,i,pointer?0xfa42+(i-42)*paletteStride+dest-(loRom(0x89fa42)+(i-42)*paletteStride):0);const data=pointer?current.slice(loRom(0x890000|pointer),loRom(0x890000|pointer)+2+n*2):new Uint8Array(2+n*2);data[0]=n*2-1;data[1]=0;changes.push(patch(`teams:palette-header:${dest}`,dest,data.slice(0,2)));for(let c=0;c<n;c++)changes.push(patch(`palette:${dest+2+c*2}`,dest+2+c*2,data.slice(2+c*2,4+c*2)));dest+=2+n*2;}
  }
  changes.push(patch('teams:tables',TABLE_POOL,tables),patch('teams:flags',FLAG_POOL,flags),patch('teams:big-labels',loRom(EXTRA_BIG_LABEL_ADDRESS),bigBytes),...labels,...extraTeamCodePatches(original,current));
  // Reuse the existing source-bank loaders and entry IDs so previously
  // relocated flags/labels are replaced atomically rather than overlapping.
  for(const id of ['flags:loader','flags:match-loader','flags:single-loader']){const [,offset,size]=FLAG_RULES.find(([key])=>key===id),bytes=current.slice(offset,offset+size);for(const n of id==='flags:single-loader'?[6,11]:[6,11,16,21])bytes[n]=0xb0;changes.push(patch(id,offset,bytes));}
  const [,offset,size]=LABEL_RULES.find(([id])=>id==='labels:loader'),loader=current.slice(offset,offset+size);for(const n of [6,11])loader[n]=0xaf;changes.push(patch('labels:loader',offset,loader));
  const flagScript=new Uint8Array(580).fill(255),labelScript=new Uint8Array(292).fill(255);flagScript.set([1,0]);labelScript.set([1,0]);
  for(let i=0;i<48;i++){
   const dest=i<2?0x4400+i*192:selectionFlagAddress(i);
   for(let part=0;part<2;part++)flagScript.set([...(asBytes(dest+part*96).slice(0,2)),0x7f,...asBytes(0xb0ca40+(i*2+part)*FLAG_SLOT)],2+(i*2+part)*6);
   labelScript.set([i*64&255,i*64>>>8,0x7f,...asBytes(0xafdf00+i*LABEL_SLOT)],2+i*6);
  }
  changes.push(patch('flags:select-script',loRom(0x82fb5d),flagScript.slice(0,508)),patch('teams:flag-script-tail',loRom(0x82fb5d)+508,flagScript.slice(508)),patch('flags:select-entry',loRom(0x87ad9a),[0x5d,0xfb]),patch('teams:label-script',loRom(0x82fda1),labelScript),patch('teams:label-entry',loRom(0x87ad97),[0xa1,0xfd]));
 }
 const metadata=new Uint8Array(256);metadata.set([84,69,65,77,1,count+1]);changes.push(patch('teams:metadata',TEAM_METADATA,metadata));
 for(const p of changes)candidate.set(p.bytes,p.offset);
 changes.push(...smallTeamNamePatches(original,candidate,count,name),...bigTeamNamePatches(original,candidate,count,name));
 const groups=editableGroups(candidate);let extra=groups.find(g=>g.name==='EXTRA');if(!extra){if(groups.length>=16)throw new Error('Libera un grupo para agregar equipos.');extra={name:'EXTRA',teams:[]};groups.push(extra);}extra.teams.push(count);
 changes.push(...editGroupsPatches(original,candidate,groups));
 // A single resource may be initialized and then named in this operation.
 return [...new Map(changes.map(p=>[p.id,p])).values()];
}
export function validateExtraTeams(rom,original){
 if(!hasExtraTeams(rom))return;
 if(hasPhysicalTeams(rom)){
  validatePhysicalTeams(rom,original);validateFlagStorage(rom,original);validateSmallLabelStorage(rom,original);return;
 }
 if(rom[TEAM_METADATA+4]!==1||teamCount(rom)<43||teamCount(rom)>48||rom.slice(TEAM_METADATA+6,TEAM_METADATA+256).some(Boolean))throw new Error('Cantidad de equipos inválida.');
 for(const p of extraTeamCodePatches(original,rom))if(p.bytes.some((b,i)=>rom[p.offset+i]!==b))throw new Error(`Rutina de equipos alterada: ${p.id}.`);
 for(let t=0;t<48;t++){
  if(teamPointer(rom,0xe730,t,4)!==0xca40+t*2*FLAG_SLOT||teamPointer(rom,0xe6c1,t)!==0xdf00+t*LABEL_SLOT)throw new Error('Punteros de equipos inválidos.');
  if(t>=42&&(teamPointer(rom,0x38138,t)!==0xfac8+(t-42)*160||teamPointer(rom,0x5ef48,t)!==0xfdd0+(t-42)*31))throw new Error('Plantel o formación inválido.');
 }
 for(const [key] of Object.entries(TEAM_TABLES)){
  const table=Number(key);if([0xe730,0xe6c1,0x1759a,0x17829].includes(table))continue;
  const stride=[0x1042e,0x104af].includes(table)?1:2;
  const originalTable=teamTable(original,table),offset=teamTable(rom,table);
  for(let t=0;t<42;t++)for(let i=0;i<stride;i++)if(rom[offset+t*stride+i]!==original[originalTable+t*stride+i])throw new Error('Tabla original de equipos alterada.');
  for(let t=42;t<48;t++){
   let expected=stride===1?original[originalTable]:word(original,originalTable);
   if(table===0x38138)expected=0xfac8+(t-42)*160;
   if(table===0x5ef48)expected=0xfdd0+(t-42)*31;
   const spec=paletteSpecs.findIndex(([key])=>key===table);
   if(spec>=0)expected=word(original,originalTable)?0xfa42+(t-42)*128+paletteSpecs.slice(0,spec).reduce((n,[,count])=>n+2+count*2,0):0;
   const actual=stride===1?rom[offset+t]:word(rom,offset+t*2);if(actual!==expected)throw new Error('Tabla adicional de equipos alterada.');
  }
 }
 for(const [old,next,stride] of TEAM_PHOTO_TABLES){const source=hasExtraTeams(original)?loRom(next):loRom(old),dest=loRom(next);for(let t=0;t<49;t++)for(let i=0;i<stride;i++)if(rom[dest+t*stride+i]!==original[source+(t<42?t:0)*stride+i])throw new Error('Tabla de fotografía adicional inválida.');}
 validateFlagStorage(rom,original);validateSmallLabelStorage(rom,original);
 for(let t=0;t<48;t++){
  const expected=t<2?0x4400+t*192:selectionFlagAddress(t);if(teamPointer(rom,0x17829,t)!==expected)throw new Error('Búfer de banderas inválido.');
 }
 for(let t=42;t<48;t++){
  let p=loRom(0x89fa42)+(t-42)*128;
  for(const [,count] of paletteSpecs){if(word(rom,p)!==count*2-1)throw new Error('Registro de paleta adicional inválido.');p+=2+count*2;}
 }
 for(const id of ['flags:loader','flags:match-loader','flags:single-loader','labels:loader']){
  const [,offset,size]=[...FLAG_RULES,...LABEL_RULES].find(([key])=>key===id),fields=id==='flags:single-loader'||id==='labels:loader'?[6,11]:[6,11,16,21];
  for(let i=0;i<size;i++)if(rom[offset+i]!== (fields.includes(i)?id==='labels:loader'?0xaf:0xb0:original[offset+i]))throw new Error('Cargador adicional inválido.');
 }
 if(word(rom,loRom(0x87ad9a))!==0xfb5d||word(rom,loRom(0x87ad97))!==0xfda1)throw new Error('Precarga adicional inválida.');
 for(const [address,count,size] of [[0x82fb5d,96,96],[0x82fda1,48,64]]){
  const offset=loRom(address);if(word(rom,offset)!==1||word(rom,offset+2+count*6)!==65535)throw new Error('Precarga adicional inválida.');
  for(let i=0;i<count;i++){
   const team=size===96?i>>>1:i,part=i%2;
   const dest=size===96?(team<2?0x4400+team*192:selectionFlagAddress(team))+part*96:team*64;
   const source=size===96?0xb0ca40+i*FLAG_SLOT:0xafdf00+i*LABEL_SLOT,p=offset+2+i*6;
   if(word(rom,p)!==dest||rom[p+2]!==0x7f||word(rom,p+3)!==(source&65535)||rom[p+5]!==source>>>16)throw new Error('Descriptor de precarga adicional inválido.');
  }
 }
 const layout=labelLayout(rom);if(layout.data[0]!==48)throw new Error('Nombres de equipos inválidos.');
}
