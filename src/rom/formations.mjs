import {teamExists,teamPointer} from './team-count.mjs';
import {word,loRom} from './binary.mjs';
export const FORMATION_LABELS=['4-5-1','4-4-2','4-3-3','4-2-4','3-5-2','3-4-3','3-3-4','3-2-5','2-5-3','2-4-4','2-3-5','5-4-1','5-3-2','5-2-3','1-5-4','1-4-5'];
export const FORMATION_ROLES={1:'Defensa',2:'Medio',3:'Delantero',5:'Defensa ofensivo',6:'Medio ofensivo'};
// DATA_8BEF48, verified in issd_mod_rom.c and the cartridge disassembly.
export function readFormation(rom,team) {
  if(!teamExists(rom,team))throw new Error('Equipo inválido.');
  const offset=loRom(0x8b0000|teamPointer(rom,0x5ef48,team));
  if(offset+31>rom.length)throw new Error('Formación fuera de la ROM.');
  const bytes=rom.slice(offset,offset+31),signed=v=>v>127?v-256:v;
  return {id:`formation:${offset}`,offset,label:FORMATION_LABELS[bytes[0]],bytes,slots:Array.from({length:10},(_,i)=>({depth:signed(bytes[1+i*2]),width:signed(bytes[2+i*2]),role:bytes[21+i]}))};
}
export function formationPatch(rom,team,source,sourceRom=rom) {
  const target=readFormation(rom,team),template=readFormation(sourceRom,source);
  return {id:target.id,offset:target.offset,label:`Formación · equipo ${team+1} (${template.label})`,bytes:template.bytes};
}
