import {externalDeluxeLayout} from './external-layout.mjs';
import {loRom,word} from './binary.mjs';

export const MAX_TEAMS=48,TEAM_METADATA=loRom(0xb0fe00);
export function hasExtraTeams(rom){return rom?.[TEAM_METADATA]===84&&rom[TEAM_METADATA+1]===69&&rom[TEAM_METADATA+2]===65&&rom[TEAM_METADATA+3]===77;}
export function hasPhysicalTeams(rom){return hasExtraTeams(rom)&&rom[TEAM_METADATA+4]===2;}
export function hasEmptyTeams(rom){return hasPhysicalTeams(rom)&&rom[TEAM_METADATA+6]===1;}
// Empty drafts retain one hidden seed so exported ROMs can create their first
// squad without requiring the original cartridge. It is never an active team.
export function teamDataRom(rom){if(!hasEmptyTeams(rom))return rom;const seed=rom.slice();seed[TEAM_METADATA+6]=0;return seed;}
export function teamCount(rom){const external=externalDeluxeLayout(rom);if(external)return external.teams;if(!hasExtraTeams(rom))return 42;const count=rom[TEAM_METADATA+5];if(count<(hasPhysicalTeams(rom)?42:43)||count>MAX_TEAMS)throw new Error('Cantidad de equipos inválida.');return count;}
export function teamExists(rom,team){return !hasEmptyTeams(rom)&&Number.isInteger(team)&&team>=0&&team<teamCount(rom)&&!(hasPhysicalTeams(rom)&&team<42&&(rom[TEAM_METADATA+8+(team>>>3)]&(1<<(team&7))));}
export function activeTeamIds(rom){return Array.from({length:teamCount(rom)},(_,i)=>i).filter(i=>teamExists(rom,i));}
export const PHYSICAL_STAR_NAMES=0x8af8a0,PHYSICAL_FALLBACK_NAMES=0x8afc60,FALLBACK_NAMES=0x87fe88,IDENTITY_MAP=0xb0fe0e,ATTRIBUTE_MAP=0xb0fe70;
export const COMPACT_GLYPH_ATLAS=0x8afd00,COMPACT_GLYPH_ATLAS_SIZE=260;
// Native tables have different strides; each relocated table reserves 49
// entries so the Challenge-mode pseudo-team can move from ID 42 to ID 48.
export const TEAM_TABLES={
  0xce8a:0xb0c400,0xe6c1:0xb0c462,0xe730:0xb0c4c4,0xe7d8:0xb0c588,
  0x1027a:0xb0c5ea,0x102d0:0xb0c64c,0x10326:0xb0c6ae,0x1037c:0xb0c710,
  0x103d2:0xb0c772,0x1042e:0xb0c7d4,0x10459:0xb0c806,
  0x104af:0xb0c868,0x1759a:0xb0c89a,0x17829:0xb0c8fc,
  0x38138:0xb0c95e,0x5ef48:0xb0c9c0,
};
export function teamTable(rom,table){const external=externalDeluxeLayout(rom);if(external)return external.paletteTables[table]??({0xe730:external.flagTable,0xe6c1:external.labelTable,0x5ef48:external.formationTable,0xce8a:external.detailTable}[table])??table;return hasExtraTeams(rom)&&TEAM_TABLES[table]?loRom(TEAM_TABLES[table]):table;}
export function teamPointer(rom,table,team,stride=2){return word(rom,teamTable(rom,table)+(externalDeluxeLayout(rom)||hasExtraTeams(rom)||team<42?team:0)*stride);}
export function attributeOffset(rom,team,player=0){const external=externalDeluxeLayout(rom);if(external)return external.attributes+team*140+player*7;return (team>=42&&hasExtraTeams(rom)?loRom(0x8af558)+(team-42)*140:0x50000+(team>=42?0:team)*140)+player*7;}
export const EXTRA_BIG_LABEL_ADDRESS=0xb0f080,EXTRA_BIG_LABEL_CAPACITY=3000;
