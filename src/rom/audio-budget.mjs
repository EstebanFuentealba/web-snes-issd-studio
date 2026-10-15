import {AUDIO_SAMPLES} from './audio-catalog.mjs';
import {loRom} from './binary.mjs';
import {audioStorage,canExtendAudio,LONG_AUDIO} from './audio-long.mjs';

// Original allocations remain in the ROM when a voice moves to a long bank.
export function calculateAudioBudget(entries,pending=null) {
  const nativeTotal=entries.reduce((sum,e)=>sum+e.nativeCapacity,0);
  let banks=entries.filter(e=>e.extended).length;
  const rows=entries.map((entry,index)=>{
    const preview=pending?.name===entry.name;
    const bytes=preview?pending.bytes:entry.bytes;
    const extended=entry.extended||(preview&&pending.long&&entry.canExtend&&bytes>entry.nativeCapacity);
    if(extended&&!entry.extended)banks++;
    const limit=extended?LONG_AUDIO.capacity:entry.nativeCapacity;
    const storedBytes=extended?2+bytes+(bytes>LONG_AUDIO.spcCapacity?Math.ceil(bytes/18)*9:0):entry.nativeCapacity;
    return {...entry,index,bytes,limit,extended,preview,storedBytes,weight:entry.nativeCapacity+(extended?LONG_AUDIO.slotSize:0),overflow:bytes>limit};
  });
  // Already allocated banks retain their place; a new preview uses the next bank.
  if(banks>LONG_AUDIO.slots)for(const row of rows)if(row.preview&&row.extended&&!entries[row.index].extended)row.overflow=true;
  const used=nativeTotal+banks*LONG_AUDIO.slotSize,capacity=nativeTotal+LONG_AUDIO.slots*LONG_AUDIO.slotSize;
  return {rows,used,capacity,banks,maxBanks:LONG_AUDIO.slots,overflow:rows.some(row=>row.overflow)};
}
export function audioBudget(rom,pending=null) {
  return calculateAudioBudget(AUDIO_SAMPLES.map(sample=>{
    const storage=audioStorage(rom,sample);
    return {name:sample.name,nativeCapacity:Math.floor((loRom(sample.end)-loRom(sample.start))/9)*9,bytes:storage.capacity,extended:storage.extended,canExtend:canExtendAudio(sample)};
  }),pending);
}
