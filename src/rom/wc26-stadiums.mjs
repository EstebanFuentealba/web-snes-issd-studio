import {externalDeluxeLayout} from './external-layout.mjs';
import {loRom,word} from './binary.mjs';
// These are source operands of the native stadium VRAM upload scripts.
// WC26 reuses the old graphics ranges for flags and moves these two assets.
// Read the loader operands, rather than treating bytes at obsolete addresses
// as graphics (they can still happen to form a valid compressed block).
const RELOCATIONS={
  0x9aa4c2:[0x82861a,0x828631,0x828713,0x82872f],
  0x9ab6f2:[0x828606,0x8286aa],
};
export function stadiumAssetAddress(rom,address){
 if(!externalDeluxeLayout(rom)||!RELOCATIONS[address])return address;
 const values=RELOCATIONS[address].map(a=>{const o=loRom(a);return word(rom,o)|rom[o+2]<<16;});
 if(values.some(a=>a!==values[0]))throw new Error('Los cargadores de este recurso de estadio WC26 no coinciden.');
 loRom(values[0]);return values[0];
}
