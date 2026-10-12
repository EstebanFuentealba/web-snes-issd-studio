import {loRom,word,decompress} from './binary.mjs';
import {compress} from './compression.mjs';

// These resources belong only to the team selector. Sprite positions are
// packed Y:X; the names use BG3 while flags and their cursor use OBJ.
export const GROUP_LAYOUT_RULES=[
 ['flag-positions',0x879fa3,12],['cursor-positions',0x879fbf,12],
 ['flag-objects',0x87ae82,1],['name-layout',0x87ae59,5],['name-tiles',0x87c50c,36],
 ['arrow-left',0x879faf,4],['arrow-right',0x879fb3,4],['panel',0x9bc9cf,449],['background-height',0x81d53d,1],
].map(([id,address,size])=>[`group-editor:layout-${id}`,loRom(address),size]);
export function groupLayoutPatches(original,columns,legacy={}){
 const patches=GROUP_LAYOUT_RULES.map(([id,offset,size])=>({id,offset,bytes:Uint8Array.from(original.subarray(offset,offset+size)),label:'Columnas en Grupos'}));
 if(columns===3)return patches;
 if(columns!==4)throw new Error('Selecciona 3 o 4 columnas.');
 const set=(name,bytes)=>patches.find(p=>p.id===`group-editor:layout-${name}`).bytes.set(bytes);
 set('flag-positions',[60,152,100,152,140,152,180,152,180,152,180,152]);
 set('cursor-positions',[59,150,99,150,139,150,179,150,179,150,179,150]);
 set('flag-objects',[3]);
 // The blue fill is a separate HDMA window: its lower band originally
 // lasts 72 scanlines. Shorten it by the same 24 pixels as the BG1 border.
 if(!legacy.fullHeightBackground)set('background-height',[48]);
 // Script $24: destination tile $02A7, one row, 19 tiles, row stride 1.
 set('name-layout',[0xa7,2,19,1,1]);
 const names=new Uint8Array(36);names.set([0x8a,0x8b,0x8c,0x8d,0,0x8e,0x8f,0x90,0x91,0,0x9a,0x9b,0x9c,0x9d,0,0x9e,0x9f,0xa0,0xa1]);set('name-tiles',names);
 for(const name of ['arrow-left','arrow-right']){const patch=patches.find(p=>p.id.endsWith(name));patch.bytes[1]=160;patch.bytes[3]=160;}
 const panel=patches.find(p=>p.id.endsWith('layout-panel')),map=decompress(original,panel.offset);
 // Move the lower edge below the single flag/name row. Clear the old edge
 // and side walls without changing the surrounding screen's tiles.
 map.copyWithin(23*64+4*2,26*64+4*2,26*64+28*2);
 for(let row=24;row<=27;row++)for(let x=4;x<28;x++){map[(row*32+x)*2]=0;map[(row*32+x)*2+1]=0x18;}
 const encoded=compress(map,!!(word(original,panel.offset)&0x8000));
 if(encoded.length>panel.bytes.length)throw new Error('El panel de grupos excede su espacio reservado.');
 panel.bytes.fill(255);panel.bytes.set(encoded);return patches;
}
