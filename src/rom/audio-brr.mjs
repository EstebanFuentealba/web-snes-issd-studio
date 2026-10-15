// BRR predictor/filter arithmetic follows the SNES half-scale domain.
// Reference: issd-native/deps/snesrecomp/runner/src/snes/dsp.c.
export function decodeBrr(bytes, streamed = false) {
  if (!bytes.length || bytes.length % 9) throw new Error('Muestra BRR incompleta.');
  const samples = [];
  let previous = 0, older = 0;
  for (let block = 0; block < bytes.length; block += 9) {
    const header = bytes[block], shift = header >>> 4, filter = (header >>> 2) & 3;
    for (let n = 0; n < 16; n++) {
      const packed = bytes[block + 1 + (n >>> 1)];
      let value = n % 2 ? packed & 15 : packed >>> 4;
      if (value > 7) value -= 16;
      value = shift <= 12 ? (value << shift) >> 1 : value & ~0x7ff;
      if (filter === 1) value += previous + (-previous >> 4);
      if (filter === 2) value += 2 * previous + (3 * -previous >> 5) - older + (older >> 4);
      if (filter === 3) value += 2 * previous + (13 * -previous >> 6) - older + (3 * older >> 4);
      value = Math.max(-32768, Math.min(32767, value));
      value = ((value & 0x7fff) << 17) >> 17;
      older = previous; previous = value;
      samples.push(value * 2);
    }
    // Preview plays once, even for samples carrying a loop flag.
    if ((header & 1) && !streamed) return Int16Array.from(samples);
  }
  if (bytes[bytes.length - 9] & 1) return Int16Array.from(samples);
  throw new Error('La muestra BRR no tiene bloque final.');
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
// Decimate by two with a windowed sinc low-pass; retain the original BRR in
// the ROM archive, and use this bounded copy only in the SPC playback buffer.
export function halfRateBrr(bytes) {
  const source=decodeBrr(bytes),samples=new Int16Array(Math.ceil(source.length/2));
  const taps=24,weights=[];let sum=0;
  for(let k=-taps;k<=taps;k++){const w=(k===0?.45:Math.sin(Math.PI*.45*k)/(Math.PI*k))*(.5+.5*Math.cos(Math.PI*k/(taps+1)));weights.push(w);sum+=w;}
  for(let i=0;i<samples.length;i++){let value=0;for(let k=-taps;k<=taps;k++)value+=source[Math.max(0,Math.min(source.length-1,i*2+k))]*weights[k+taps];samples[i]=Math.max(-32768,Math.min(32767,Math.round(value/sum)));}
  return encodeBrr(samples,Math.ceil(samples.length/16)*9);
}
