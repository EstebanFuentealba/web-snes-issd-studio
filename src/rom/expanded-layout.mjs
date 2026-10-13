// v3 uses a 4 MiB LoROM. The original 2 MiB remains the project base;
// new banks own each squad independently. Legacy TEAM v1/v2 stays readable.
export const EXPANDED_TEAMS=56,EXPANDED_ROM_SIZE=0x400000;
const metadata=0x187e00;
export const hasExpandedTeams=rom=>rom?.[metadata]===84&&rom[metadata+1]===69&&rom[metadata+2]===65&&rom[metadata+3]===77&&rom[metadata+4]===3;
export const EXPANDED={tables:0xc08000,identity:0xc0a000,attributes:0xc0a100,names:0xc48000,flags:0xc58000,labels:0xc68000,photos:0xc78000,code:0xc88000,bigLabels:0xc89000,bigCapacity:4096,flagScript:0x82fb5d,labelScript:0x82fe04,palette:0xc19000};
const specs=[[0xce8a,2],[0xe6c1,2],[0xe730,4],[0xe7d8,2],[0x1027a,2],[0x102d0,2],[0x10326,2],[0x1037c,2],[0x103d2,2],[0x1042e,1],[0x10459,2],[0x104af,1],[0x1759a,2],[0x17829,2],[0x38138,2],[0x5ef48,2]];
let cursor=EXPANDED.tables;
export const EXPANDED_TABLES=Object.fromEntries(specs.map(([table,stride])=>{const address=cursor;cursor+=(EXPANDED_TEAMS+1)*stride;return [table,address];}));
export const expandedFlagBuffer=team=>team<2?0x4400+team*192:team<32?0x0a80+team*192:team<48?0x3400+(team-32)*192:0x6000+(team-48)*192;
export const expandedLabelBuffer=team=>team<48?team*64:0x4600+(team-48)*64;
export const playerNameLength=rom=>hasExpandedTeams(rom)?10:8;
export function expandedRomBuffer(rom){if(rom.length===EXPANDED_ROM_SIZE)return rom.slice();const bytes=new Uint8Array(EXPANDED_ROM_SIZE).fill(255);bytes.set(rom);return bytes;}
