import {loRom} from './binary.mjs';

// All twelve 16-bit reads of $7ED854 in the USA disassembly. Replacing
// LDA long with LDA #value / NOP keeps every branch and routine size intact.
// This covers sprites, palettes, animations and barks, including linesmen.
const ADDRESSES=[0x80f141,0x84aa20,0x84faa5,0x84faeb,0x84fd27,0x84fe15,0x84ff52,0x84ff8a,0x86d52e,0x86d962,0x8bd0f9,0xa4e174];
export const DOG_REFEREE_RULES=ADDRESSES.map(address=>[`dog-referee:${address.toString(16)}`,loRom(address),4]);
const MODES={original:[0xaf,0x54,0xd8,0x7e],enabled:[0xa9,1,0,0xea],disabled:[0xa9,0,0,0xea]};
export function dogRefereeMode(rom){
  for(const [mode,bytes] of Object.entries(MODES))if(DOG_REFEREE_RULES.every(([,offset])=>bytes.every((byte,i)=>rom[offset+i]===byte)))return mode;
  throw new Error('Código del árbitro perro no compatible.');
}
export function validateDogReferee(rom){dogRefereeMode(rom);}
export function dogRefereePatches(rom,enabled){
  validateDogReferee(rom);
  if(typeof enabled!=='boolean')throw new Error('Configuración del árbitro perro inválida.');
  return DOG_REFEREE_RULES.map(([id,offset])=>({id,offset,bytes:Uint8Array.from(MODES[enabled?'enabled':'disabled']),label:'Mostrar árbitro perro'}));
}
