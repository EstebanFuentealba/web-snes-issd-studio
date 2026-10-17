import {decompress,word,loRom} from './binary.mjs';
import {compress} from './graphics.mjs';
import {externalDeluxeLayout} from './external-layout.mjs';
import {MUSIC_TRACKS} from './music-catalog.mjs';
export {MUSIC_TRACKS};
export const MUSIC_BASE=0x4900;
// Timer 0 runs at 125 Hz: tempo/256 driver ticks per timer pulse, 48 PPQN.
export const MUSIC_TEMPO_BPM=156.25/256;
const lengths=[1,2,1,1,3,3,0,3,0,3,1,2,1,1,1,2,1,3,1,3,3,3,0,0,2,1,3,1,1,2,2,0];
const signed=n=>n>127?n-256:n;
export function musicDriver(rom){
 if(externalDeluxeLayout(rom))throw new Error('Driver musical no compatible.');
 const driver=decompress(rom,loRom(0xbd8000));
 if(driver.length!==0x4700||driver.subarray(0x3718-0x200,0x3720-0x200).some(Boolean)||![0x5f,0x34,0x0e].every((v,i)=>driver[0x272-0x200+i]===v)||lengths.some((n,i)=>driver[0x1637-0x200+i*2]!==n)||![0x1c,0xfd,0xf6,0xf8,0x15].every((v,i)=>driver[0x1447-0x200+i]===v))throw new Error('Driver musical no compatible.');
 return driver;
}
export function musicResources(rom){try{musicDriver(rom);return MUSIC_TRACKS.filter(s=>word(rom,s.offset)<=s.capacity&&word(rom,s.offset)>2&&Array.from({length:20},(_,i)=>loRom(0x829d23)+i*4).some(o=>{const a=rom[o+1]|rom[o+2]<<8|rom[o+3]<<16;return (a&0x8000)&&loRom(a)===s.offset;})).map(s=>{const index=Array.from({length:20},(_,i)=>i).find(i=>{const o=loRom(0x829d23)+i*4;return loRom(rom[o+1]|rom[o+2]<<8|rom[o+3]<<16)===s.offset;});return {...s,id:`music:${s.name}`,channels:index<5?8:index<17?6:3};});}catch{return [];}}
function integer(n,min,max){if(!Number.isInteger(n)||n<min||n>max)throw new Error('Valor musical fuera de rango.');return n;}
// Display all native channels over a common horizon, executing short loops as
// the driver does. Repeated notes retain their original editable source offsets.
export function decodeMusic(bytes){
 const first=decodeSequence(bytes),horizon=Math.max(...first.tracks.map(t=>t.length));
 if(!horizon||!first.tracks.some(t=>t.loop))return first;
 const expanded=decodeSequence(bytes,horizon);
 expanded.tracks.forEach((track,i)=>{track.loop=first.tracks[i].loop;if(track.loop)track.length=horizon;});
 return expanded;
}
function decodeSequence(bytes,horizon=0){
 if(!(bytes instanceof Uint8Array)||bytes.length<3||bytes.length>0x2000)throw new Error('Secuencia musical inválida.');
 const at=p=>{if(!Number.isInteger(p)||p<0||p>=bytes.length)throw new Error('Puntero musical fuera del bloque.');return bytes[p];};
 const ptr=p=>at(p)|(at(p+1)<<8);
 const count=(ptr(0)-MUSIC_BASE)/2;integer(count,1,8);
 const tracks=[];let tempo=255;
 for(let channel=0;channel<count;channel++){
  let p=ptr(channel*2)-MUSIC_BASE,tick=0,len=0,rate=127,instrument=0,transpose=0,percussion=false,ret=null,steps=0;
  const notes=[],loops=[null,null],jumps=new Set();let loop=false;
  while(true){
   if(horizon&&tick>=horizon)break;
   if(++steps>20000||notes.length>4096||tick>1000000)throw new Error('La secuencia musical excede el límite de eventos.');
   const offset=p,cmd=at(p++);
   if(cmd<0x60||(cmd>=0x80&&cmd<0xe0)){
    let lengthOffset=null,rateOffset=null;
    if(!(cmd&128)){lengthOffset=p;len=at(p++);}if(!len)throw new Error('Duración musical inválida.');
    let velocity=at(p++);if(!(velocity&128)){rateOffset=p-1;rate=velocity;velocity=at(p++);}
    notes.push({offset,lengthOffset,rateOffset,velocityOffset:p-1,tick,length:len,duration:rate===127?len:Math.max(1,Math.floor(len*rate/128)),pitch:percussion?(cmd&127)+36:(cmd&127)+transpose,rawPitch:cmd&127,velocity:velocity&127,instrument,percussion,channel});tick+=len;if(p<bytes.length&&at(p)===0xf3){for(let i=0;i<6;i++)at(p++);}continue;
   }
   if(cmd===0x60){percussion=true;continue;}if(cmd===0x61){percussion=false;continue;}
   if(cmd>=0x70&&cmd<=0x7f)continue;
   if(cmd===0x62){at(p++);continue;}
   if(cmd<0xe0)throw new Error('Comando musical no compatible.');
   const args=Array.from({length:cmd===0xfc?2:cmd===0xf1?5:lengths[cmd-0xe0]},()=>at(p++));
   if(cmd===0xe0){len=args[0];tick+=len;if(p<bytes.length&&at(p)===0xf3){for(let i=0;i<6;i++)at(p++);}}
   if(cmd===0xe1){len=args[0];rate=args[1];const last=notes.at(-1);if(last)last.duration+=rate===127?len:Math.max(1,Math.floor(len*rate/128));tick+=len;}
   if(cmd===0xe2)instrument=args[0];if(cmd===0xfc)instrument=args[1];
   if(cmd===0xea)tempo=args[0];
   if(cmd===0xec)transpose=signed(args[0]);
   if(cmd===0xe6||cmd===0xe8)loops[cmd===0xe6?0:1]={start:p,count:0};
   if(cmd===0xe7||cmd===0xe9){const l=loops[cmd===0xe7?0:1];if(!l)throw new Error('Bucle musical inválido.');if(!args[0]){loop=true;if(!horizon)break;p=l.start;continue;}if(++l.count<args[0]){if(args[1]||args[2])throw new Error('Bucle musical con variación no compatible.');p=l.start;}}
   // Volta changes execution conditionally: keep unsupported songs protected.
   if(cmd===0xf6||cmd===0xf7)throw new Error('Bucle musical condicional no compatible.');
   if(cmd===0xfd){const dest=args[0]|args[1]<<8;if(jumps.has(dest)||dest-MUSIC_BASE<=offset){loop=true;if(!horizon)break;}jumps.add(dest);p=dest-MUSIC_BASE;}
   if(cmd===0xfe){if(ret!==null)throw new Error('Subrutina musical anidada no compatible.');ret=p;p=(args[0]|args[1]<<8)-MUSIC_BASE;}
   if(cmd===0xff){if(ret!==null){p=ret;ret=null;}else break;}
  }
  tracks.push({channel,notes,length:tick,loop,instrument:notes[0]?.instrument??instrument});
 }
 return {tracks,tempo,bpm:tempo*MUSIC_TEMPO_BPM};
}
export function readMusic(rom,resource){musicDriver(rom);const bytes=decompress(rom,resource.offset),song=decodeMusic(bytes);if(song.tracks.length!==resource.channels)throw new Error('El número de canales no coincide con el evento musical nativo.');return {bytes,...song};}
export function editMusicNote(bytes,note,values){
 const result=bytes.slice();
 if(values.pitch!==undefined)result[note.offset]=(result[note.offset]&128)|integer(values.pitch-(note.pitch-note.rawPitch),0,95);
 if(values.velocity!==undefined)result[note.velocityOffset]=(result[note.velocityOffset]&128)|integer(values.velocity,1,127);
 if(values.length!==undefined){if(note.lengthOffset===null)throw new Error('Esta nota hereda la duración de un evento anterior.');result[note.lengthOffset]=integer(values.length,1,255);}
 decodeMusic(result);return result;
}
export function musicPatch(rom,resource,decoded){
 if(!musicResources(rom).some(r=>r.id===resource.id&&r.offset===resource.offset&&r.capacity===resource.capacity))throw new Error('Recurso musical no compatible.');
 if(decodeMusic(decoded).tracks.length!==resource.channels)throw new Error('El número de canales no coincide con el evento musical nativo.');const encoded=compress(decoded);if(encoded.length>resource.capacity)throw new Error('La canción supera su espacio original en la ROM.');
 const bytes=rom.slice(resource.offset,resource.offset+resource.capacity);bytes.set(encoded);
 return {id:resource.id,offset:resource.offset,bytes,label:`Música · ${resource.name}`};
}
export function validateMusicResource(rom,original,id){
 const resource=musicResources(original).find(r=>r.id===id);if(!resource)throw new Error('Recurso musical no compatible.');
 const current=rom.subarray(resource.offset,resource.offset+resource.capacity),base=original.subarray(resource.offset,resource.offset+resource.capacity);
 if(current.every((v,i)=>v===base[i]))return;
 if(word(rom,resource.offset)>resource.capacity)throw new Error('La canción supera su espacio original en la ROM.');
 if(decodeMusic(decompress(rom,resource.offset)).tracks.length!==resource.channels)throw new Error('El número de canales no coincide con el evento musical nativo.');
}
// Compile a deliberately small, monophonic-per-voice subset. Native effects
// remain lossless for in-place edits; imported MIDI uses this explicit subset.
export function compileMusic(song,channels){
 integer(channels,1,8);integer(song.tempo,1,255);
 if(song.tracks.length>channels)throw new Error('El MIDI supera los canales disponibles de esta canción.');
 const output=new Array(channels*2).fill(0);
 for(let c=0;c<channels;c++){
  const start=output.length+MUSIC_BASE;output[c*2]=start&255;output[c*2+1]=start>>>8;
  const track=song.tracks[c]||{notes:[],instrument:0};integer(track.instrument,0,29);
  output.push(0xea,song.tempo,0xee,220,0xe2,track.instrument,0xe3,20);
  let tick=0;
  for(const note of [...track.notes].sort((a,b)=>a.tick-b.tick)){
   integer(note.tick,0,1000000);integer(note.duration,1,255);integer(note.pitch,0,95);integer(note.velocity,1,127);
   if(note.tick<tick)throw new Error('Cada canal SPC700 admite una sola nota simultánea.');
   let rest=note.tick-tick;while(rest){const n=Math.min(rest,255);output.push(0xe0,n);rest-=n;}
   output.push(note.pitch,note.duration,127,note.velocity|128);tick=note.tick+note.duration;
  }
  output.push(0xff);
 }
 const bytes=Uint8Array.from(output);decodeMusic(bytes);return bytes;
}
