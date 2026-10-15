import {decodeBrr,halfRateBrr} from './audio-brr.mjs';
import {LONG_AUDIO_METADATA,LONG_AUDIO_MAGIC,hasLongAudio,hasSafeLongAudio} from './audio-long-format.mjs';
export {hasLongAudio,hasSafeLongAudio} from './audio-long-format.mjs';
import {compress} from './graphics.mjs';
import {loRom,word,decompress} from './binary.mjs';
import {AUDIO_SAMPLES} from './audio-catalog.mjs';
// Independent 32 KiB LoROM banks after the expanded-team resources (C0-C8).
export const LONG_AUDIO={pool:0x280000,slots:32,slotSize:0x8000,capacity:21375,spcStart:0x3800,spcEnd:0x6900,spcCapacity:12537,driver:0x380000,driverSize:0x8000,driverPointer:0x11e82,metadata:LONG_AUDIO_METADATA,metadataSize:256,pointers:0x11d9b};
const magic=LONG_AUDIO_MAGIC;
export const ANNOUNCER_NAMES=["CornerKick","GoalKick","ThrowIn","FreeKick1","PenaltyKick","OffSide","Replay","HalfTime","InjuryTime","GreatSave1","GoodBowl","LongBall1","GreatCross","GoodHeader1","GreatTackle1","OnTheVolley","AmazingKick","GoodTouch","YouLose","YouWin","MatchDraw","PlayerChange","GoodClearance","KeepAFumble","OverTheBar1","PastThePost1","ThrewBall","Interception","NiceDummy1","GreatPunch1","BlockedShot","NoFoul","ItsOneOnOne","OneTwo","DirtyPlayRef","DownTheWay","Semifinal","Final","Kickoff","Foul","YellowCard","RedCard","HesOff","HeShoots1","ItsABigKick1","IncredibleControl","Goal","GoGo","OhNo","OwnGoal","OverTheBar2","ItsABigKick2","Intersection","GoodCharge","FreeKick2","GreatSave2","GreatTackle2","GoodHeader2","LongBall2","GoodLob1","NiceDummy2","PastThePost2","GreatPunch2","HeShoots2","OhNo","Corner","TimeUp","GoodLob2","Yes","GOOOOOOOOOOOOAAAAAALLLLLL","Explosion","DogBark","DogBark","DogBark"];
const ptr=(rom,o)=>rom[o]|rom[o+1]<<8|rom[o+2]<<16;
const record=sample=>8+AUDIO_SAMPLES.findIndex(s=>s.name===sample.name)*3;
const address=slot=>0xd08000+slot*0x10000;
export const canExtendAudio=sample=>ANNOUNCER_NAMES.includes(sample.name)&&!['Explosion','DogBark','GOOOOOOOOOOOOAAAAAALLLLLL'].includes(sample.name);
export function audioStorage(rom,sample){
 const nativeOffset=loRom(sample.start),i=LONG_AUDIO.metadata+record(sample),slot=hasLongAudio(rom)?rom[i]:255;
 if(slot!==255){if(slot>=LONG_AUDIO.slots)throw new Error('Directorio de audio largo inválido.');const capacity=word(rom,i+1),playbackDivisor=hasSafeLongAudio(rom)&&capacity>LONG_AUDIO.spcCapacity?2:1,playbackCapacity=playbackDivisor===2?Math.ceil(capacity/18)*9:capacity,playbackOffset=LONG_AUDIO.pool+slot*LONG_AUDIO.slotSize+2;
  return {nativeOffset,offset:playbackOffset+(playbackDivisor===2?playbackCapacity:0),capacity,playbackOffset,playbackCapacity,playbackDivisor,extended:true,slot};}
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
function extendedDriver(rom,meta,safe=true){
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
  if(safe)driver[script+2]=word(meta,record(sample)+1)>LONG_AUDIO.spcCapacity?0x27:0x33;
 });
 if(safe){
  // $3717-$48FF is zero-filled padding in the original driver. Use $3800
  // through $68FF for voice playback; resident effects start at $6900.
  if(driver.slice(0x3517).some(b=>b!==0))throw new Error('El controlador no tiene espacio libre para audio seguro.');
  const table=0x3720-0x200;ANNOUNCER_NAMES.forEach((name,i)=>{const sample=AUDIO_SAMPLES.find(s=>s.name===name);driver[table+i+1]=meta[record(sample)]===255?0:1;});
  const code=[],labels=new Map(),branches=[];const emit=(...bytes)=>code.push(...bytes),label=name=>labels.set(name,code.length),branch=(op,name)=>{emit(op,0);branches.push([code.length-1,name]);};
  emit(0x2d,0xf8,0x2c,0xf5,0x20,0x37);branch(0xf0,'native');
  emit(0xe4,0xd0,0x68,0x50);branch(0xb0,'discard'); // preserve music priority without writing into its samples
  emit(0xae,0x5c);branch(0xb0,'repeat'); // F1 retriggers the cached voice; it has no transfer payload
  emit(0x8f,1,0x2d,0xba,0x2c,0xda,0x28,0x8f,0x80,0x27,0x8f,0,0x2a,0x8f,0,0x2b); // force first slot; invalidate the overwritten second cache
  emit(0x8f,1,0x25,0x8f,1,0x2d,0x8f,0xfe,0x2e,0x8f,0x37,0x2f);
  emit(0xe8,0,0xc5,0xcc,4,0xe8,0x38,0xc5,0xcd,4,0xcd,2,0x8f,0x38,5,0x5f,0x4c,0x0b);
  label('native');emit(0xe8,0,0xc5,0xcc,4,0xe8,0x49,0xc5,0xcd,4,0xae,0x68,0xf8);branch(0x90,'valid');emit(0x5f,0xa7,0x0a);
  label('valid');emit(0x5f,0xd4,0x0a);
  label('repeat');emit(0x5f,0x9d,0x0a);
  label('discard');emit(0xae,0x5c);branch(0xb0,'repeat');emit(0x8f,1,0x25,0x8f,0x80,0x26,0x8f,0xfe,0x2e,0x8f,0x37,0x2f,0x5f,0x8d,0x0b);
  for(const [at,name] of branches){const delta=labels.get(name)-at-1;if(delta< -128||delta>127)throw new Error('Hook SPC fuera de rango.');code[at]=delta&255;}
  if(code.length>0x7e)throw new Error('Hook SPC demasiado grande.');
  if(![0x68,0xf8,0xb0,0xd3].every((v,i)=>driver[0xad0-0x200+i]===v))throw new Error('Cargador SPC700 no compatible.');
  driver.set([0x5f,0x80,0x37,0],0xad0-0x200);driver.set(code,0x3780-0x200);
 }
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
export function refreshLongAudioDriverPatches(rom){return driverPatches(rom,metadata(rom));}
export function longAudioPatches(rom,sample,bytes){
 if(!canExtendAudio(sample))throw new Error('Esta muestra no admite audio largo.');
 if(!bytes.length||bytes.length%9||bytes.length>LONG_AUDIO.capacity)throw new Error('El audio largo supera la capacidad de un banco LoROM.');
 const meta=metadata(rom),index=record(sample),current=audioStorage(rom,sample);
 let slot=current.extended?current.slot:-1;
 if(slot<0){const used=new Set(AUDIO_SAMPLES.map(s=>meta[record(s)]));slot=Array.from({length:LONG_AUDIO.slots},(_,i)=>i).find(i=>!used.has(i)&&(rom.length<=LONG_AUDIO.pool+i*LONG_AUDIO.slotSize||rom.subarray(LONG_AUDIO.pool+i*LONG_AUDIO.slotSize,LONG_AUDIO.pool+(i+1)*LONG_AUDIO.slotSize).every(b=>b===255)));}
 if(slot===undefined)throw new Error('No queda espacio libre para otro audio largo.');
 const legacy=hasLongAudio(rom)&&!hasSafeLongAudio(rom);
 const changes=[];
 const writeBank=(bankSlot,original,voiceName=sample.name)=>{const playback=original.length>LONG_AUDIO.spcCapacity?halfRateBrr(original):original;
  if(playback.length>LONG_AUDIO.spcCapacity)throw new Error('La voz supera el búfer seguro del SPC700.');
  const bank=new Uint8Array(LONG_AUDIO.slotSize).fill(255);bank[0]=Math.floor((playback.length+2)/3)&255;bank[1]=Math.floor((playback.length+2)/3)>>>8;bank.set(playback,2);
  if(playback!==original)bank.set(original,2+playback.length);
  changes.push({id:`audio-long:slot:${bankSlot}`,offset:LONG_AUDIO.pool+bankSlot*LONG_AUDIO.slotSize,bytes:bank,label:`Audio largo · ${voiceName}`});
 };
 if(legacy)for(const other of AUDIO_SAMPLES){if(other.name===sample.name)continue;const region=audioStorage(rom,other);if(region.extended)writeBank(region.slot,rom.slice(region.offset,region.offset+region.capacity),other.name);}
 writeBank(slot,bytes);meta.set(magic);
 meta[index]=slot;meta[index+1]=bytes.length&255;meta[index+2]=bytes.length>>>8;
 changes.unshift({id:'audio-long:metadata',offset:LONG_AUDIO.metadata,bytes:meta});
 ANNOUNCER_NAMES.forEach((name,i)=>{if(name!==sample.name)return;const o=LONG_AUDIO.pointers+i*3,old=current.extended?address(current.slot):sample.start-2;if(ptr(rom,o)!==old)throw new Error('El cargador de voces de esta ROM no es compatible con audio largo.');const a=address(slot);changes.push({id:`audio-long:pointer:${i}`,offset:o,bytes:Uint8Array.of(a&255,a>>>8&255,a>>>16)});});
 changes.push(...driverPatches(rom,meta));
 if(rom[0x7fd7]!==12)changes.push({id:'audio-long:size',offset:0x7fd7,bytes:Uint8Array.of(12)});
 return changes.map(p=>({...p,label:p.label||`Audio largo · ${sample.name}`}));
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
 const meta=rom.slice(LONG_AUDIO.metadata,LONG_AUDIO.metadata+LONG_AUDIO.metadataSize),expected=extendedDriver(rom,meta,hasSafeLongAudio(rom));
 if(ptr(rom,LONG_AUDIO.driverPointer)!==0xf08000)throw new Error('Puntero de audio largo inválido.');
 const actual=decompress(rom,LONG_AUDIO.driver);if(actual.length!==expected.length||actual.some((b,i)=>b!==expected[i]))throw new Error('El controlador SPC700 de esta ROM no admite audio largo.');
 const used=new Set();
 for(const sample of AUDIO_SAMPLES){const region=audioStorage(rom,sample);if(!region.extended)continue;
  if(!canExtendAudio(sample)||used.has(region.slot)||region.capacity<9||region.capacity>LONG_AUDIO.capacity||region.capacity%9)throw new Error('Directorio de audio largo inválido.');used.add(region.slot);
  if(word(rom,(region.playbackOffset??region.offset)-2)!==Math.floor(((region.playbackCapacity??region.capacity)+2)/3))throw new Error('Longitud de transferencia de audio inválida.');
  const bytes=rom.slice(region.offset,region.offset+region.capacity);decode(bytes);
  if(hasSafeLongAudio(rom)){const playback=rom.slice(region.playbackOffset,region.playbackOffset+region.playbackCapacity),expected=region.playbackDivisor===2?halfRateBrr(bytes):bytes;if(playback.length>LONG_AUDIO.spcCapacity||playback.some((v,i)=>v!==expected[i]))throw new Error('Copia de reproducción segura inválida.');}
  if(Array.from({length:bytes.length/9},(_,i)=>bytes[i*9]&3).some((f,i)=>f!==(i===bytes.length/9-1?1:0)))throw new Error('El audio largo debe terminar sin bucle.');
 }
 ANNOUNCER_NAMES.forEach((name,i)=>{const sample=AUDIO_SAMPLES.find(s=>s.name===name),region=audioStorage(rom,sample);if(ptr(rom,LONG_AUDIO.pointers+i*3)!==(region.extended?address(region.slot):sample.start-2))throw new Error('Puntero de audio largo inválido.');});
}

export function upgradeLongAudioPatches(rom,patches=[]) {
 const context=rom.slice();for(const patch of patches)context.set(patch.bytes,patch.offset);
 if(!hasLongAudio(context)||hasSafeLongAudio(context))return patches;
 validateLongAudio(context,decodeBrr);
 const sample=AUDIO_SAMPLES.find(s=>audioStorage(context,s).extended);if(!sample)return patches;
 const region=audioStorage(context,sample),upgrades=longAudioPatches(context,sample,context.slice(region.offset,region.offset+region.capacity));
 return Array.from(new Map([...patches,...upgrades].map(p=>[p.id,p])).values());
}
