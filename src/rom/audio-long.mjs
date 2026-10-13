import {compress} from './graphics.mjs';
import {loRom,word,decompress} from './binary.mjs';
import {AUDIO_SAMPLES} from './audio-catalog.mjs';
// Independent 32 KiB LoROM banks after the expanded-team resources (C0-C8).
export const LONG_AUDIO={pool:0x280000,slots:32,slotSize:0x8000,capacity:21375,driver:0x380000,driverSize:0x8000,driverPointer:0x11e82,metadata:0x3e0000,metadataSize:256,pointers:0x11d9b};
const magic=[73,83,83,65,85,68,1,0];
export const ANNOUNCER_NAMES=["CornerKick","GoalKick","ThrowIn","FreeKick1","PenaltyKick","OffSide","Replay","HalfTime","InjuryTime","GreatSave1","GoodBowl","LongBall1","GreatCross","GoodHeader1","GreatTackle1","OnTheVolley","AmazingKick","GoodTouch","YouLose","YouWin","MatchDraw","PlayerChange","GoodClearance","KeepAFumble","OverTheBar1","PastThePost1","ThrewBall","Interception","NiceDummy1","GreatPunch1","BlockedShot","NoFoul","ItsOneOnOne","OneTwo","DirtyPlayRef","DownTheWay","Semifinal","Final","Kickoff","Foul","YellowCard","RedCard","HesOff","HeShoots1","ItsABigKick1","IncredibleControl","Goal","GoGo","OhNo","OwnGoal","OverTheBar2","ItsABigKick2","Intersection","GoodCharge","FreeKick2","GreatSave2","GreatTackle2","GoodHeader2","LongBall2","GoodLob1","NiceDummy2","PastThePost2","GreatPunch2","HeShoots2","OhNo","Corner","TimeUp","GoodLob2","Yes","GOOOOOOOOOOOOAAAAAALLLLLL","Explosion","DogBark","DogBark","DogBark"];
const ptr=(rom,o)=>rom[o]|rom[o+1]<<8|rom[o+2]<<16;
const record=sample=>8+AUDIO_SAMPLES.findIndex(s=>s.name===sample.name)*3;
const address=slot=>0xd08000+slot*0x10000;
export const hasLongAudio=rom=>magic.every((b,i)=>rom?.[LONG_AUDIO.metadata+i]===b);
export const canExtendAudio=sample=>ANNOUNCER_NAMES.includes(sample.name)&&!['Explosion','DogBark','GOOOOOOOOOOOOAAAAAALLLLLL'].includes(sample.name);
export function audioStorage(rom,sample){
 const nativeOffset=loRom(sample.start),i=LONG_AUDIO.metadata+record(sample),slot=hasLongAudio(rom)?rom[i]:255;
 if(slot!==255){if(slot>=LONG_AUDIO.slots)throw new Error('Directorio de audio largo inválido.');return {nativeOffset,offset:LONG_AUDIO.pool+slot*LONG_AUDIO.slotSize+2,capacity:word(rom,i+1),extended:true,slot};}
 return {nativeOffset,offset:nativeOffset,capacity:Math.floor((loRom(sample.end)-nativeOffset)/9)*9,extended:false};
}
export function longAudioRules(){return [
 ['audio-long:metadata',LONG_AUDIO.metadata,LONG_AUDIO.metadataSize,'audio-long'],
 ['audio-long:size',0x7fd7,1,'audio-long'],
 ['audio-long:driver',LONG_AUDIO.driver,LONG_AUDIO.driverSize,'audio-long'],
 ['audio-long:driver-pointer',LONG_AUDIO.driverPointer,3,'audio-long'],
 ...ANNOUNCER_NAMES.map((_,i)=>[`audio-long:pointer:${i}`,LONG_AUDIO.pointers+i*3,3,'audio-long']),
 ...Array.from({length:LONG_AUDIO.slots},(_,i)=>[`audio-long:slot:${i}`,LONG_AUDIO.pool+i*LONG_AUDIO.slotSize,LONG_AUDIO.slotSize,'audio-long'])
 ];}
function metadata(rom){
 if(hasLongAudio(rom))return rom.slice(LONG_AUDIO.metadata,LONG_AUDIO.metadata+LONG_AUDIO.metadataSize);
 if(rom.length>LONG_AUDIO.metadata&&!rom.subarray(LONG_AUDIO.metadata,LONG_AUDIO.metadata+LONG_AUDIO.metadataSize).every(b=>b===255))throw new Error('El espacio reservado para audio largo está ocupado.');
 const b=new Uint8Array(LONG_AUDIO.metadataSize).fill(255);b.set(magic);return b;
}
function extendedDriver(rom,meta){
 const driver=decompress(rom,0x1e8000);
 if(driver.length!==0x4700)throw new Error('El controlador SPC700 de esta ROM no admite audio largo.');
 ANNOUNCER_NAMES.forEach((name,i)=>{const sample=AUDIO_SAMPLES.find(s=>s.name===name);if(meta[record(sample)]===255)return;
  const script=word(driver,0x72c-0x200+i*2)-0x200;
  // OhNo's secondary event is intentionally silent in the native engine.
  if(name==='OhNo'&&script===0x8b5-0x200&&driver[script]===255)return;
  if(driver[script]!==0xee||![0xfe,0xfc,0xf0].includes(driver[script+1])||driver[script+2]!==0x33||driver[script+4]!==0x7d||driver[script+5]!==0x7f||driver[script+6]!==0xff)throw new Error('El guion de esta voz no admite audio largo.');
  // Native gates otherwise cut this voice after $42 ticks (~1.05 seconds).
  // Keep its pitch/instrument/volume; let END terminate BRR within 255 ticks.
  driver[script+3]=255;
 });
 return driver;
}
function driverPatches(rom,meta){
 const old=ptr(rom,LONG_AUDIO.driverPointer);
 if(![0xbd8000,0xf08000].includes(old))throw new Error('El controlador SPC700 de esta ROM no admite audio largo.');
 if(old!==0xf08000&&rom.length>LONG_AUDIO.driver&&!rom.subarray(LONG_AUDIO.driver,LONG_AUDIO.driver+LONG_AUDIO.driverSize).every(b=>b===255))throw new Error('El espacio reservado para audio largo está ocupado.');
 const encoded=compress(extendedDriver(rom,meta));if(encoded.length>LONG_AUDIO.driverSize)throw new Error('El controlador SPC700 de esta ROM no admite audio largo.');
 const bytes=new Uint8Array(LONG_AUDIO.driverSize).fill(255);bytes.set(encoded);
 return [{id:'audio-long:driver',offset:LONG_AUDIO.driver,bytes},{id:'audio-long:driver-pointer',offset:LONG_AUDIO.driverPointer,bytes:Uint8Array.of(0,128,240)}];
}
export function longAudioPatches(rom,sample,bytes){
 if(!canExtendAudio(sample))throw new Error('Esta muestra no admite audio largo.');
 if(!bytes.length||bytes.length%9||bytes.length>LONG_AUDIO.capacity)throw new Error('El audio largo supera la capacidad de un banco LoROM.');
 const meta=metadata(rom),index=record(sample),current=audioStorage(rom,sample);
 let slot=current.extended?current.slot:-1;
 if(slot<0){const used=new Set(AUDIO_SAMPLES.map(s=>meta[record(s)]));slot=Array.from({length:LONG_AUDIO.slots},(_,i)=>i).find(i=>!used.has(i)&&(rom.length<=LONG_AUDIO.pool+i*LONG_AUDIO.slotSize||rom.subarray(LONG_AUDIO.pool+i*LONG_AUDIO.slotSize,LONG_AUDIO.pool+(i+1)*LONG_AUDIO.slotSize).every(b=>b===255)));}
 if(slot===undefined)throw new Error('No queda espacio libre para otro audio largo.');
 const bank=new Uint8Array(LONG_AUDIO.slotSize).fill(255);bank[0]=Math.floor((bytes.length+2)/3)&255;bank[1]=Math.floor((bytes.length+2)/3)>>>8;bank.set(bytes,2);
 meta[index]=slot;meta[index+1]=bytes.length&255;meta[index+2]=bytes.length>>>8;
 const changes=[{id:'audio-long:metadata',offset:LONG_AUDIO.metadata,bytes:meta},{id:`audio-long:slot:${slot}`,offset:LONG_AUDIO.pool+slot*LONG_AUDIO.slotSize,bytes:bank}];
 ANNOUNCER_NAMES.forEach((name,i)=>{if(name!==sample.name)return;const o=LONG_AUDIO.pointers+i*3,old=current.extended?address(current.slot):sample.start-2;if(ptr(rom,o)!==old)throw new Error('El cargador de voces de esta ROM no es compatible con audio largo.');const a=address(slot);changes.push({id:`audio-long:pointer:${i}`,offset:o,bytes:Uint8Array.of(a&255,a>>>8&255,a>>>16)});});
 changes.push(...driverPatches(rom,meta));
 if(rom[0x7fd7]!==12)changes.push({id:'audio-long:size',offset:0x7fd7,bytes:Uint8Array.of(12)});
 return changes.map(p=>({...p,label:`Audio largo · ${sample.name}`}));
}
export function restoreLongAudioPatches(original,rom,sample){
 const region=audioStorage(rom,sample),base=audioStorage(original,sample);if(!region.extended)return [];
 if(base.extended)return longAudioPatches(rom,sample,original.slice(base.offset,base.offset+base.capacity));
 const meta=metadata(rom),index=record(sample);meta.fill(255,index,index+3);
 const changes=[{id:'audio-long:metadata',offset:LONG_AUDIO.metadata,bytes:meta},{id:`audio-long:slot:${region.slot}`,offset:LONG_AUDIO.pool+region.slot*LONG_AUDIO.slotSize,bytes:new Uint8Array(LONG_AUDIO.slotSize).fill(255)}];
 ANNOUNCER_NAMES.forEach((name,i)=>{if(name===sample.name){const a=sample.start-2;changes.push({id:`audio-long:pointer:${i}`,offset:LONG_AUDIO.pointers+i*3,bytes:Uint8Array.of(a&255,a>>>8&255,a>>>16)});}});
 changes.push(...driverPatches(rom,meta));
 return changes.map(p=>({...p,label:`Restaurar audio · ${sample.name}`}));
}
export function validateLongAudio(rom,decode){
 if(!hasLongAudio(rom))throw new Error('Directorio de audio largo inválido.');
 if(rom.length!==0x400000||rom[0x7fd7]!==12)throw new Error('Tamaño de ROM para audio largo inválido.');
 const meta=rom.slice(LONG_AUDIO.metadata,LONG_AUDIO.metadata+LONG_AUDIO.metadataSize),expected=extendedDriver(rom,meta);
 if(ptr(rom,LONG_AUDIO.driverPointer)!==0xf08000)throw new Error('Puntero de audio largo inválido.');
 const actual=decompress(rom,LONG_AUDIO.driver);if(actual.length!==expected.length||actual.some((b,i)=>b!==expected[i]))throw new Error('El controlador SPC700 de esta ROM no admite audio largo.');
 const used=new Set();
 for(const sample of AUDIO_SAMPLES){const region=audioStorage(rom,sample);if(!region.extended)continue;
  if(!canExtendAudio(sample)||used.has(region.slot)||region.capacity<9||region.capacity>LONG_AUDIO.capacity||region.capacity%9)throw new Error('Directorio de audio largo inválido.');used.add(region.slot);
  if(word(rom,region.offset-2)!==Math.floor((region.capacity+2)/3))throw new Error('Longitud de transferencia de audio inválida.');
  const bytes=rom.slice(region.offset,region.offset+region.capacity);decode(bytes);
  if(Array.from({length:bytes.length/9},(_,i)=>bytes[i*9]&3).some((f,i)=>f!==(i===bytes.length/9-1?1:0)))throw new Error('El audio largo debe terminar sin bucle.');
 }
 ANNOUNCER_NAMES.forEach((name,i)=>{const sample=AUDIO_SAMPLES.find(s=>s.name===name),region=audioStorage(rom,sample);if(ptr(rom,LONG_AUDIO.pointers+i*3)!==(region.extended?address(region.slot):sample.start-2))throw new Error('Puntero de audio largo inválido.');});
}
