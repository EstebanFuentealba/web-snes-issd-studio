import {teamExists,teamPointer} from './team-count.mjs';
import {loRom} from './binary.mjs';
export const FORMATION_LABELS=['4-5-1','4-4-2','4-3-3','4-2-4','3-5-2','3-4-3','3-3-4','3-2-5','2-5-3','2-4-4','2-3-5','5-4-1','5-3-2','5-2-3','1-5-4','1-4-5'];
export const FORMATION_ROLES={1:'Defensa',2:'Medio',3:'Delantero',5:'Defensa ofensivo',6:'Medio ofensivo'};
// CODE_85AA4A copies all 16 menu presets from DATA_828134 (20 position
// bytes each) and DATA_828074 (10 roles each). CODE_85AA7F then overlays
// the selected team's 31-byte record on its default preset.
const PRESET_POSITIONS=loRom(0x828134),PRESET_ROLES=loRom(0x828074);
function decodeFormation(bytes,offset) {
  const signed=v=>v>127?v-256:v;
  return {id:`formation:${offset}`,offset,label:FORMATION_LABELS[bytes[0]],bytes,slots:Array.from({length:10},(_,i)=>({depth:signed(bytes[1+i*2]),width:signed(bytes[2+i*2]),role:bytes[21+i]}))};
}
export function readFormationPreset(rom,index) {
  if(!Number.isInteger(index)||index<0||index>=FORMATION_LABELS.length)throw new Error('Formación inválida.');
  const positions=PRESET_POSITIONS+index*20,roles=PRESET_ROLES+index*10;
  if(positions+20>rom.length||roles+10>rom.length)throw new Error('Formación fuera de la ROM.');
  const bytes=new Uint8Array(31);bytes[0]=index;
  bytes.set(rom.subarray(positions,positions+20),1);
  bytes.set(rom.subarray(roles,roles+10),21);
  return decodeFormation(bytes,positions);
}
export function formationPresetPatch(rom,team,index,sourceRom=rom) {
  const target=readFormation(rom,team),template=readFormationPreset(sourceRom,index);
  return {id:target.id,offset:target.offset,label:`Formación · equipo ${team+1} (${template.label})`,bytes:template.bytes};
}
// DATA_8BEF48, verified in issd_mod_rom.c and the cartridge disassembly.
export function readFormation(rom,team) {
  if(!teamExists(rom,team))throw new Error('Equipo inválido.');
  const offset=loRom(0x8b0000|teamPointer(rom,0x5ef48,team));
  if(offset+31>rom.length)throw new Error('Formación fuera de la ROM.');
  return decodeFormation(rom.slice(offset,offset+31),offset);
}
export function formationPatch(rom,team,source,sourceRom=rom) {
  const target=readFormation(rom,team),template=readFormation(sourceRom,source);
  return {id:target.id,offset:target.offset,label:`Formación · equipo ${team+1} (${template.label})`,bytes:template.bytes};
}

export const formationLine=role=>(role&3)-1;
// DATA_81DC0E: the native menu accepts absolute offsets below $14/$18
// in depth (DF/MF/FW) and below $28 in width. Roles use bit 2 for attack.
export function formationLimits(role) {return {depth:formationLine(role)===1?23:19,width:39};}
export function formationPoint(slot) {return {x:[30,80,130][formationLine(slot.role)]+slot.depth,y:50+slot.width};}
export function formationSlotAt(slot,x,y) {
  const limits=formationLimits(slot.role),clamp=(v,max)=>Math.max(-max,Math.min(max,Math.round(v)));
  return {...slot,depth:clamp(x-[30,80,130][formationLine(slot.role)],limits.depth),width:clamp(y-50,limits.width)};
}
export function validateFormation(bytes) {
  if(!(bytes instanceof Uint8Array)||bytes.length!==31||bytes[0]>=FORMATION_LABELS.length)throw new Error('Formación inválida.');
  const counts=FORMATION_LABELS[bytes[0]].split('-').map(Number);
  for(let i=0;i<10;i++) {
    const role=bytes[21+i],line=i<counts[0]?0:i<counts[0]+counts[1]?1:2;
    if(![1,2,3,5,6].includes(role)||formationLine(role)!==line)throw new Error('Roles incompatibles con el esquema de formación.');
    const {depth,width}=decodeFormation(bytes,0).slots[i],limits=formationLimits(role);
    if(Math.abs(depth)>limits.depth||Math.abs(width)>limits.width)throw new Error('Posición fuera de los límites de la formación.');
  }
}
export function customFormationPatch(rom,team,index,slots) {
  if(!Array.isArray(slots)||slots.length!==10||!Number.isInteger(index)||index<0||index>=FORMATION_LABELS.length)throw new Error('Formación inválida.');
  const target=readFormation(rom,team),bytes=new Uint8Array(31);bytes[0]=index;
  slots.forEach((slot,i)=>{
    if(!Number.isInteger(slot.depth)||!Number.isInteger(slot.width)||!Number.isInteger(slot.role)||slot.depth<-128||slot.depth>127||slot.width<-128||slot.width>127)throw new Error('Posición fuera de los límites de la formación.');
    bytes[1+i*2]=slot.depth;bytes[2+i*2]=slot.width;bytes[21+i]=slot.role;
  });
  validateFormation(bytes);
  return {id:target.id,offset:target.offset,label:`Formación · equipo ${team+1} (${FORMATION_LABELS[index]})`,bytes};
}
