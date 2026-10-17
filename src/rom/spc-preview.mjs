import {parseSPC} from '../vendor/spc700-js/index.mjs';
import {readSpc} from './music-spc.mjs';
const signature='SNES-SPC700 Sound File Data';
// Opening a machine snapshot for listening never authorizes importing its
// executable driver, samples, DSP state or unknown sequence into a game ROM.
export function inspectSpc(input){
 const bytes=new Uint8Array(input);if(bytes.length<0x10180||bytes.length>2000000||![...signature].every((c,i)=>bytes[i]===c.charCodeAt(0))||bytes[33]!==26||bytes[34]!==26)throw new Error('Archivo SPC inválido.');
 let snapshot;try{snapshot=parseSPC(bytes);}catch{throw new Error('Archivo SPC inválido.');}const tags=snapshot.tags,play=tags.introSeconds!=null&&tags.loopSeconds!=null?tags.introSeconds+tags.loopSeconds*(tags.loopCount??2)+(tags.endSeconds??0):tags.playSeconds??180,fade=(tags.fadeMilliseconds??5000)/1000;
 return {bytes:bytes.slice(),tags,duration:Math.max(1,Math.min(3600,play+fade))};
}
export function openSpc(input,rom,resource){
 const preview=inspectSpc(input);try{return {kind:'native',sequence:readSpc(preview.bytes,rom,resource)};}catch(error){return {kind:'external',...preview,reason:error.message};}
}
