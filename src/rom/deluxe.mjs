import {wc26TeamPresentation} from './wc26-data.mjs';
import {externalDeluxeLayout} from './external-layout.mjs';
import {teamCount,teamExists,hasPhysicalTeams,PHYSICAL_STAR_NAMES,hasExtraTeams,teamPointer,teamTable,attributeOffset as playerAttributeOffset} from './team-count.mjs';
import { word, loRom, decompress, tiles, palette } from './binary.mjs';
import { flagBank, labelBank } from './graphics.mjs';
import { deluxeAppearance } from './appearance.mjs';

// Native team order verified by issd-native/ISSDNative/issd_mod_rom.c.
export const DELUXE_TEAMS = ['Italy', 'Holland', 'England', 'Norway', 'Spain', 'Ireland', 'Portugal', 'Denmark', 'Germany', 'France', 'Belgium', 'Sweden', 'Romania', 'Bulgaria', 'Russia', 'Swiss', 'Greece', 'Croatia', 'Austria', 'Wales', 'Scotland', 'N.Ireland', 'Czech Rep.', 'Poland', 'Japan', 'S.Korea', 'Turkey', 'Nigeria', 'Cameroon', 'Morocco', 'Brazil', 'Argentina', 'Colombia', 'Mexico', 'U.S.A.', 'Uruguay', 'All Stars', 'Euro Stars A', 'Euro Stars B', 'Asian Stars', 'African Stars', 'All American Stars'];

export function deluxeText(bytes) {
  return Array.from(bytes, byte => {
    if (byte >= 0x68 && byte <= 0x81) return String.fromCharCode(65 + byte - 0x68);
    if (byte >= 0x82 && byte <= 0x9b) return String.fromCharCode(97 + byte - 0x82);
    return ({ 0: ' ', 0x54: '.', 0x57: '-', 0x56: '"', 0x5a: "'", 0x5c: "'", 0x5f: '/' })[byte] ?? '�';
  }).join('').trim();
}

export function deluxeAttributes(bytes) {
  const fields = ['acceleration', 'speed', 'shotPower', 'curl', 'balance', 'intelligence', 'dribbling', 'jump', 'position', 'energy'];
  const result = {};
  fields.forEach((key, index) => {
    const nibble = index % 2 ? bytes[index >>> 1] & 15 : bytes[index >>> 1] >>> 4;
    result[key] = nibble + (key === 'position' ? 0 : 1);
  });
  return { ...result, no: bytes[5] + 1, skin: bytes[6] >>> 4, hair: bytes[6] & 15 };
}

export function readDeluxeTeam(rom, index) {
  if (!teamExists(rom,index)) throw new Error('Equipo inválido.');
  const external=externalDeluxeLayout(rom);
  if(external)return {...wc26TeamPresentation(rom,index),players:Array.from({length:20},(_,p)=>({name:deluxeText(rom.slice(deluxePlayerNameOffset(rom,index,p),deluxePlayerNameOffset(rom,index,p)+external.nameLength)),...deluxeAttributes(rom.slice(playerAttributeOffset(rom,index,p),playerAttributeOffset(rom,index,p)+7)),...deluxeAppearance(rom,index,deluxeAttributes(rom.slice(playerAttributeOffset(rom,index,p),playerAttributeOffset(rom,index,p)+7)))}))};
  const players = Array.from({ length: 20 }, (_, player) => {
    const nameOffset = deluxePlayerNameOffset(rom,index,player), attributeOffset = playerAttributeOffset(rom,index,player);
    const attributes = deluxeAttributes(rom.slice(attributeOffset, attributeOffset + 7));
    return { name: deluxeText(rom.slice(nameOffset, nameOffset + 8)), ...attributes, ...deluxeAppearance(rom, index, attributes) };
  });
  // Original pointer tables in Routine_Macros_ISSD.asm: DATA_81E730,
  // DATA_81E7D8 and DATA_81E6C1. Palette record starts with a size word.
  const flag = [0, 2].flatMap(part => {
    const address = flagBank(rom)<<16 | word(rom,teamTable(rom,0xe730)+(hasExtraTeams(rom)||index<42?index:0)*4+part);
    return tiles(decompress(rom, loRom(address)), 4, 3);
  });
  const colors = new Array(16).fill('transparent');
  colors.splice(12, 4, ...palette(rom, loRom(0x890000 | teamPointer(rom,0xe7d8,index)) + 2, 4));
  const nameAddress = labelBank(rom)<<16 | teamPointer(rom,0xe6c1,index);
  const teamMatrix = tiles(decompress(rom, loRom(nameAddress)), 2, 4);
  return { name: DELUXE_TEAMS[index]||`TEAM ${index+1}`, sharedPlayerNames:index>=36&&index<42&&!hasPhysicalTeams(rom), players, flag, colors, teamMatrix, teamColors: ['transparent', '#ffffff', '#b8b8b8', '#555555'] };
}

// CODE_A49C89 / DATA_A4F643: star teams assemble names from national squads.
export function deluxePlayerNameOffset(rom,team,player){
  const external=externalDeluxeLayout(rom);if(external)return loRom(external.nameBank<<16|word(rom,external.nameTable+team*2))+player*external.nameLength;
  if(hasPhysicalTeams(rom)&&team>=36&&team<42)return loRom(PHYSICAL_STAR_NAMES)+(team-36)*160+player*8;
  if(team>=36&&team<42){
    const refs=loRom(0xa40000|word(rom,loRom(0xa4f643)+(team-36)*2))+player*4;
    const source=word(rom,refs)/2,slot=word(rom,refs+2)/8;
    if(!Number.isInteger(source)||source<0||source>=36||!Number.isInteger(slot)||slot<0||slot>=20)throw new Error('Referencia de jugador de estrellas inválida.');
    return loRom(0x870000|word(rom,0x38138+source*2))+slot*8;
  }
  return loRom(0x870000|teamPointer(rom,0x38138,team))+player*8;
}
