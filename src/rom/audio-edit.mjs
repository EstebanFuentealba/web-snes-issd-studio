import { loRom } from './binary.mjs';
import { AUDIO_SAMPLES, decodeBrr } from './audio.mjs';
export const STREAMED=['TitleScreenNameDrop','VictoryMusic','UnknownShout','UnknownIntroSample'];
export function audioRegion(rom,sample) {
  const offset=loRom(sample.start),span=loRom(sample.end)-offset,capacity=Math.floor(span/9)*9;
  const bytes=rom.slice(offset,offset+capacity);
  const headers=Array.from({length:capacity/9},(_,i)=>bytes[i*9]);
  const segmented=sample.name==='TitleScreenNameDrop';
  const reason=segmented?'':STREAMED.includes(sample.name)?'Recurso transmitido por fragmentos: necesita conservar el protocolo SPC700.':headers.some(h=>h&2)?'Contiene loop BRR: falta verificar el punto de bucle del directorio SPC700.':headers.slice(0,-1).some(h=>h&1)?'Tiene finales intermedios: estructura de reproducción pendiente.':!(headers.at(-1)&1)?'Final BRR no verificado.':'';
  return {offset,capacity,bytes,reason,segmented};
}
export function pitchRate(pitch) {
  if(!Number.isInteger(pitch)||pitch<1||pitch>0x3fff) throw new Error('El pitch DSP debe estar entre 1 y 16383.');
  return 32000*pitch/4096;
}
export function parseWav(buffer) {
  const view=new DataView(buffer),tag=o=>String.fromCharCode(...new Uint8Array(buffer,o,4));
  if(buffer.byteLength<44||tag(0)!=='RIFF'||tag(8)!=='WAVE')throw new Error('Se requiere un archivo WAV RIFF PCM.');
  const end=view.getUint32(4,true)+8;if(end>buffer.byteLength)throw new Error('WAV truncado.');
  let format,region;
  for(let cursor=12;cursor+8<=end;) {
    const size=view.getUint32(cursor+4,true),start=cursor+8;
    if(start+size>end)throw new Error('Chunk WAV truncado.');
    if(tag(cursor)==='fmt ') {
      if(size<16)throw new Error('Formato WAV truncado.');
      format={type:view.getUint16(start,true),channels:view.getUint16(start+2,true),rate:view.getUint32(start+4,true),align:view.getUint16(start+12,true),bits:view.getUint16(start+14,true)};
      if(format.type===0xfffe&&size>=40&&view.getUint16(start+16,true)>=22){const guid=new Uint8Array(buffer,start+24,16);if(guid.slice(4).every((b,i)=>b===[0,0,16,0,128,0,0,170,0,56,155,113][i]))format.type=view.getUint32(start+24,true);}
    }
    if(tag(cursor)==='data')region={start,size};cursor=start+size+(size%2);
  }
  if(!format||!region||![1,3].includes(format.type)||format.channels<1||format.channels>8||!(format.type===3?[32,64]:[8,16,24,32]).includes(format.bits)||format.align!==format.channels*format.bits/8||format.rate<1||format.rate>768000||region.size%format.align)throw new Error('Este WAV necesita conversión mediante el decodificador del navegador.');
  const count=region.size/format.align;
  if(count>10000000)throw new Error('El WAV supera el límite de 10 millones de muestras.');
  const samples=new Int16Array(count);
  for(let i=0;i<count;i++) {
    let sum=0;
    for(let c=0;c<format.channels;c++){
      const p=region.start+i*format.align+c*format.bits/8;let value;
      if(format.type===3)value=(format.bits===32?view.getFloat32(p,true):view.getFloat64(p,true))*32768;
      else if(format.bits===8)value=(view.getUint8(p)-128)*256;
      else if(format.bits===16)value=view.getInt16(p,true);
      else if(format.bits===24){const raw=view.getUint8(p)|(view.getUint8(p+1)<<8)|(view.getUint8(p+2)<<16);value=((raw<<8)>>8)/256;}
      else value=view.getInt32(p,true)/65536;
      sum+=Number.isFinite(value)?value:0;
    }
    samples[i]=Math.max(-32768,Math.min(32767,Math.round(sum/format.channels)));
  }
  return {samples,sampleRate:format.rate};
}
export function resample(samples,from,to) {
  if(!Number.isFinite(to)||to<1||to>128000||!Number.isFinite(from)||from<1)throw new Error('Frecuencia inválida.');
  const size=Math.round(samples.length*to/from);if(size>10000000)throw new Error('Audio remuestreado demasiado grande.');
  return Int16Array.from({length:size},(_,i)=> {const x=i*from/to,a=Math.min(samples.length-1,Math.floor(x)),b=Math.min(samples.length-1,a+1);return Math.round(samples[a]*(1-(x-a))+samples[b]*(x-a));});
}
// Waveform-similarity overlap-add: keep sample spacing (pitch) while changing
// the analysis hop. Correlation aligns adjacent grains before their crossfade.
export function stretchAudio(wav,factor=1) {
  if(!Number.isFinite(factor)||factor<.1||factor>2)throw new Error('El stretch debe estar entre 10 y 200 %.');
  const {samples,sampleRate}=wav;
  if(!Number.isFinite(sampleRate)||sampleRate<1)throw new Error('Frecuencia inválida.');
  const length=Math.round(samples.length*factor);
  if(length>10000000)throw new Error('Audio remuestreado demasiado grande.');
  if(factor===1||!samples.length)return {samples:samples.slice(),sampleRate};
  const window=Math.min(samples.length,Math.max(16,Math.round(sampleRate*.04))),hop=Math.max(1,Math.floor(window/2)),search=Math.round(sampleRate*.008);
  const output=new Float64Array(length+window),weights=new Float64Array(length+window);
  const stride=Math.max(1,Math.floor(sampleRate/8000));
  let previous=0;
  for(let dest=0;dest<length;dest+=hop){
    const expected=Math.min(samples.length-window,Math.round(dest/factor));
    let source=expected;
    if(dest){
      const low=Math.max(0,expected-search),high=Math.min(samples.length-window,expected+search);
      let best=-Infinity;
      for(let candidate=low;candidate<=high;candidate+=stride){
        let dot=0,a2=0,b2=0;
        for(let i=0;i<hop;i+=stride){const a=samples[previous+hop+i]||0,b=samples[candidate+i]||0;dot+=a*b;a2+=a*a;b2+=b*b;}
        const score=a2&&b2?dot/Math.sqrt(a2*b2):0;
        // Prefer the expected position when matching silence or equal scores.
        const ranked=score-1e-7*Math.abs(candidate-expected);
        if(ranked>best){best=ranked;source=candidate;}
      }
    }
    for(let i=0;i<window;i++){
      const weight=Math.sin(Math.PI*(i+.5)/window)**2;
      output[dest+i]+=samples[source+i]*weight;weights[dest+i]+=weight;
    }
    previous=source;
  }
  return {samples:Int16Array.from({length},(_,i)=>Math.max(-32768,Math.min(32767,Math.round(output[i]/weights[i])))),sampleRate};
}

// Normalize active-signal RMS, excluding silence below -40 dB of the peak.
// The soft knee keeps transients inside filter-0 BRR's representable range.
export function normalizeAudio(samples) {
  let peak=0;for(const value of samples)peak=Math.max(peak,Math.abs(value));
  if(!peak)return samples.slice();
  const gate=peak*.01,target=8192,knee=24576,ceiling=28672;
  const limit=value=>value<=knee?value:knee+(ceiling-knee)*(1-1/(1+(value-knee)/(ceiling-knee)));
  let energy=0,count=0;
  for(const value of samples)if(Math.abs(value)>gate){energy+=value*value;count++;}
  const rms=gain=>{let sum=0;for(const value of samples)if(Math.abs(value)>gate){const output=limit(Math.abs(value)*gain);sum+=output*output;}return Math.sqrt(sum/count);};
  let low=0,high=target/Math.sqrt(energy/count);
  while(rms(high)<target)high*=2;
  for(let i=0;i<18;i++){const gain=(low+high)/2;if(rms(gain)<target)low=gain;else high=gain;}
  const gain=(low+high)/2;
  return Int16Array.from(samples,value=>Math.sign(value)*Math.round(limit(Math.abs(value)*gain)));
}

// Filter 0 makes independent blocks, preserving fixed allocation and providing
// deterministic quantization. It sacrifices compression quality, never memory safety.
export function encodeBrr(samples,capacity) {
  if(!Number.isInteger(capacity)||capacity<9||capacity%9||samples.length<1||samples.length>capacity/9*16)throw new Error(`El audio supera la capacidad de ${capacity/9*16} muestras.`);
  const bytes=new Uint8Array(capacity);
  for(let block=0;block<capacity/9;block++) {
    const input=Array.from({length:16},(_,i)=>samples[block*16+i]||0);let best;
    for(let shift=1;shift<=12;shift++) {
      const step=2**shift,nibbles=input.map(v=>Math.max(-8,Math.min(7,Math.round(v/step))));
      const error=nibbles.reduce((sum,v,i)=>sum+(input[i]-v*step)**2,0);
      if(!best||error<best.error)best={shift,nibbles,error};
    }
    bytes[block*9]=best.shift<<4;
    for(let i=0;i<8;i++)bytes[block*9+1+i]=((best.nibbles[i*2]&15)<<4)|(best.nibbles[i*2+1]&15);
  }
  bytes[capacity-9]|=1;decodeBrr(bytes);return bytes;
}
export function replacementAudio(rom,sample,wav,pitch) {
  const region=audioRegion(rom,sample);if(region.reason)throw new Error(region.reason);
  const rate=pitchRate(pitch),count=Math.floor(wav.samples.length*rate/wav.sampleRate);
  if(count>region.capacity/9*16)throw new Error(`Duración máxima a este pitch: ${(region.capacity/9*16/rate).toFixed(3)} s. Elige un WAV más corto.`);
  const samples=normalizeAudio(resample(wav.samples,wav.sampleRate,rate).subarray(0,region.capacity/9*16)),bytes=encodeBrr(samples,region.capacity);
  // CODE_80C115 loads this fixed-size BRR bank at SPC $A66B. Its
  // directory uses blocks 0/200/897/2000, with a loop at block 103.
  // Keep every original end/loop marker and address while replacing PCM.
  if(region.segmented)for(let i=0;i<bytes.length;i+=9)bytes[i]=(bytes[i]&0xfc)|(region.bytes[i]&3);
  return {patch:{id:`audio:${region.offset}`,label:`Audio · ${sample.name}`,offset:region.offset,bytes},samples:decodeBrr(bytes,region.segmented),rate};
}

export function floatChannelsToMono(channels){
  if(!channels.length||channels.length>32||!channels[0].length||channels[0].length>10000000||channels.some(c=>c.length!==channels[0].length))throw new Error('Audio vacío o demasiado grande.');
  const samples=new Int16Array(channels[0].length);
  for(let i=0;i<samples.length;i++){let sum=0;for(const channel of channels)sum+=Number.isFinite(channel[i])?channel[i]:0;samples[i]=Math.max(-32768,Math.min(32767,Math.round(sum/channels.length*32768)));}
  return samples;
}
export async function decodeUploadedAudio(buffer){
  try{const wav=parseWav(buffer);return {...wav,conversion:'Convertido a PCM de 16 bits / mono'};}catch(parseError){
    const Context=globalThis.OfflineAudioContext||globalThis.webkitOfflineAudioContext;
    if(!Context)throw parseError;
    try{const context=new Context(1,1,48000),audio=await context.decodeAudioData(buffer.slice(0));
      return {samples:floatChannelsToMono(Array.from({length:audio.numberOfChannels},(_,i)=>audio.getChannelData(i))),sampleRate:audio.sampleRate,conversion:'Decodificado y convertido a PCM de 16 bits / mono'};
    }catch{throw new Error('No se pudo decodificar este audio. Prueba un WAV PCM/float, MP3, M4A, OGG o FLAC válido.');}
  }
}
export function trimAudio(wav,start,end){
  const duration=wav.samples.length/wav.sampleRate;
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>duration+1/wav.sampleRate)throw new Error('Selecciona un recorte dentro del audio.');
  const first=Math.max(0,Math.round(start*wav.sampleRate)),last=Math.min(wav.samples.length,Math.round(end*wav.sampleRate));
  if(last<=first)throw new Error('El recorte debe contener al menos una muestra.');
  return {samples:wav.samples.slice(first,last),sampleRate:wav.sampleRate};
}

export function normalizedAudioPatches(rom,patches) {
  const modified=new Set(patches.filter(p=>p.id.startsWith('audio:')).map(p=>p.id)),changes=[];
  for(const sample of AUDIO_SAMPLES){
    const region=audioRegion(rom,sample),id=`audio:${region.offset}`;
    if(!modified.has(id))continue;
    if(region.reason)continue;
    const bytes=encodeBrr(normalizeAudio(decodeBrr(region.bytes,region.segmented)),region.capacity);
    for(let i=0;i<bytes.length;i+=9)bytes[i]=(bytes[i]&0xfc)|(region.bytes[i]&3);
    changes.push({id,label:`Audio normalizado · ${sample.name}`,offset:region.offset,bytes});
  }
  return changes;
}
