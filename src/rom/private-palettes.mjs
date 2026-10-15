import {loRom,word} from './binary.mjs';
import {externalDeluxeLayout} from './external-layout.mjs';
// WC26 keeps its 2 MiB layout. This unused bank-B0 region has 56 private 128-byte slots.
export const PRIVATE_PALETTE_POOL=0xb0e000,PRIVATE_PALETTE_CODE=0xb0fc00;
export const PALETTE_SPECS=[[0x1027a,16],[0x102d0,16],[0x10326,11],[0x1037c,5],[0x103d2,1],[0xe7d8,4]];
const hook=[0x5c,0,0xfc,0xb0,0xea,0xea,0xea],native=[0x29,0xfe,0,0xaa,0xbd,0x76,0x91];
// CODE_80A4EF owns the palette DMA bank. Preserve native pointers; low-half
// private pointers are converted to bank B0's high half before both MVN paths.
const code=(()=>{
 const out=[0x48,0x98,0xc9,0,0x60,0x90,0,0xc9,0,0x7c,0xb0,0];
 out.push(0x68,0x29,0xfe,0,0xaa,0xbd,0x76,0x91,0x48,0x98,0x09,0,0x80,0xa8,0x4a,0xb0,0x11,0xf4,0xb0,0,0xab,0x28,0xb9,0,0,0xbb,0xe8,0xe8,0x7a,0x54,0x7e,0xb0,0x80,0x0f,0xf4,0xb0,0,0xab,0x28,0xb9,0,0,0xbb,0xe8,0xe8,0x7a,0x54,0x7e,0xb0,0x7a,0xfa,0xab,0x6b);
 const fallback=out.length;out[6]=fallback-7;out[11]=fallback-12;out.push(0x68,...native,0x5c,0xf6,0xa4,0x80);return Uint8Array.from(out);
})();
export const hasPrivatePalettes=rom=>hook.every((b,i)=>rom?.[0x24ef+i]===b);
export function privatePaletteOffset(rom,pointer){return hasPrivatePalettes(rom)&&pointer>=0x6000&&pointer<0x7c00?loRom(0xb08000|pointer):null;}
export function privatePaletteRules(rom){
 const profile=externalDeluxeLayout(rom);if(!profile)return [];
 const rules=[['kit-colors:loader',0x24ef,7,'raw'],['kit-colors:code',loRom(PRIVATE_PALETTE_CODE),code.length,'raw']];
 for(let team=0;team<56;team++){let dest=loRom(PRIVATE_PALETTE_POOL)+team*128;for(const [table,count]of PALETTE_SPECS){const offset=profile.paletteTables[table]+team*2;rules.push([`kit-colors:pointer:${offset}`,offset,2,'private-palette-pointer'],[`kit-colors:header:${dest}`,dest,2,'private-palette-header']);for(let i=0;i<count;i++)rules.push([`palette:${dest+2+i*2}`,dest+2+i*2,2,'palette']);dest+=2+count*2;}}
 return rules;
}
export function privateTeamColorPatches(rom,team,table,index,bytes){
 const profile=externalDeluxeLayout(rom),spec=PALETTE_SPECS.findIndex(([t])=>t===table);if(!profile||spec<0||!Number.isInteger(team)||team<0||team>=56||!Number.isInteger(index)||index<0||index>=PALETTE_SPECS[spec][1])throw new Error('Paleta de equipo inválida.');
 const patch=(id,offset,data)=>({id,offset,bytes:Uint8Array.from(data),label:'Color independiente del equipo'}),offset=profile.paletteTables[table]+team*2,pointer=word(rom,offset),source=privatePaletteOffset(rom,pointer)??loRom(0x890000|pointer),dest=loRom(PRIVATE_PALETTE_POOL)+team*128+PALETTE_SPECS.slice(0,spec).reduce((n,[,count])=>n+2+count*2,0),count=PALETTE_SPECS[spec][1];
 if(!hasPrivatePalettes(rom)){if(native.some((b,i)=>rom[0x24ef+i]!==b)||!rom.subarray(loRom(PRIVATE_PALETTE_POOL),loRom(PRIVATE_PALETTE_CODE)+code.length).every(b=>b===255))throw new Error('No hay espacio seguro para separar las paletas de este hack.');}
 const out=[patch('kit-colors:loader',0x24ef,hook),patch('kit-colors:code',loRom(PRIVATE_PALETTE_CODE),code),patch(`kit-colors:pointer:${offset}`,offset,[dest&255,(dest>>8)&0x7f]),patch(`kit-colors:header:${dest}`,dest,[count*2-1,0])];
 for(let i=0;i<count;i++)out.push(patch(`palette:${dest+2+i*2}`,dest+2+i*2,i===index?bytes:rom.slice(source+2+i*2,source+4+i*2)));
 return out;
}
export function validatePrivatePalettes(rom){
 if(!hasPrivatePalettes(rom))return;
 if(code.some((b,i)=>rom[loRom(PRIVATE_PALETTE_CODE)+i]!==b))throw new Error('Cargador de paletas independientes inválido.');
 const profile=externalDeluxeLayout(rom);if(!profile)throw new Error('Perfil de paletas independientes inválido.');
 for(let team=0;team<56;team++){let dest=loRom(PRIVATE_PALETTE_POOL)+team*128;for(const [table,count]of PALETTE_SPECS){const pointer=word(rom,profile.paletteTables[table]+team*2);if(pointer&&pointer<0x8000&&(privatePaletteOffset(rom,pointer)!==dest||word(rom,dest)!==count*2-1))throw new Error('Referencia de paleta independiente inválida.');dest+=2+count*2;}}
}
