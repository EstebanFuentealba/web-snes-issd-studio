import {decompress,word} from './binary.mjs';
import {compress} from './graphics.mjs';
import {hasLongAudio,refreshLongAudioDriverPatches} from './audio-long.mjs';

// Native SPC driver allocation. $19A2 consumes the sequencer's EON mask.
// All streamed announcer events use DSP voice 5 ($20), including long audio.
// AND #$DF keeps the other seven echo sends and all echo parameters intact.
const OFFSET=0x1e8000,SIZE=11052,COMMAND=0x19a2-0x200;
const NATIVE=[0x08,0x00],DRY=[0x28,0xdf];
export const AUDIO_REVERB_RULES=[['audio-reverb:driver',OFFSET,SIZE]];
function driver(rom){
 if((word(rom,OFFSET)&0x7fff)>SIZE)throw new Error('Controlador de reverberación no compatible.');
 const bytes=decompress(rom,OFFSET);
 if(bytes.length!==0x4700||![NATIVE,DRY].some(pair=>pair.every((v,i)=>bytes[COMMAND+i]===v))||
   ![0xf0,0x16,0xb2,0x13,0xc4,0x14,0x8f,0x4d,0xf2,0xc4,0xf3].every((v,i)=>bytes[COMMAND+2+i]===v))throw new Error('Controlador de reverberación no compatible.');
 return bytes;
}
export function announcerReverbDisabled(rom){return driver(rom)[COMMAND]===DRY[0];}
export function supportsAnnouncerReverb(rom){try{driver(rom);return true;}catch{return false;}}
export function validateAudioReverb(rom,original){
 const actual=driver(rom),expected=driver(original);
 for(let i=0;i<actual.length;i++)if((i<COMMAND||i>COMMAND+1)&&actual[i]!==expected[i])throw new Error('Controlador de reverberación alterado.');
}
export function announcerReverbPatches(original,rom,disabled){
 if(typeof disabled!=='boolean')throw new Error('Configuración de reverberación inválida.');
 validateAudioReverb(rom,original);
 const decoded=driver(rom);decoded.set(disabled?DRY:NATIVE,COMMAND);
 const pristine=driver(original),same=decoded.every((v,i)=>v===pristine[i]);
 const bytes=original.slice(OFFSET,OFFSET+SIZE);
 if(!same){const encoded=compress(decoded);if(encoded.length>SIZE)throw new Error('El controlador de reverberación supera su espacio disponible.');bytes.set(encoded);}
 const patch={id:'audio-reverb:driver',offset:OFFSET,bytes,label:'Quitar reverberación de los relatos'};
 const context=rom.slice();context.set(bytes,OFFSET);
 return [patch,...(hasLongAudio(context)?refreshLongAudioDriverPatches(context):[])];
}
