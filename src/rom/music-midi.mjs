import {MUSIC_TEMPO_BPM} from './music.mjs';
// Standard MIDI file subset: metrical format 0/1, note/program events and a
// constant tempo. Reject unsupported timing instead of silently changing it.
const fail=()=>{throw new Error('MIDI no compatible: usa formato 0/1, tempo constante y notas sin superposición por canal.');};
export function readMidi(input){
 const b=new Uint8Array(input);if(b.length>2000000)fail();let p=0;
 const byte=()=>{if(p>=b.length)fail();return b[p++];},u16=()=>byte()*256+byte(),u32=()=>u16()*65536+u16(),tag=()=>String.fromCharCode(byte(),byte(),byte(),byte());
 const vlq=()=>{let n=0;for(let i=0;i<4;i++){const v=byte();n=n*128+(v&127);if(!(v&128))return n;}fail();};
 if(tag()!=='MThd'||u32()!==6)fail();const format=u16(),count=u16(),division=u16();if(format>1||!count||count>128||!division||(division&32768)||(format===0&&count!==1))fail();
 const channels=new Map();let tempo=null,events=0;
 for(let t=0;t<count;t++){
  if(tag()!=='MTrk')fail();const size=u32(),end=p+size;if(end>b.length)fail();let tick=0,running=0;const active=new Map();
  while(p<end){if(++events>100000)fail();tick+=vlq();let status=byte();if(status<128){if(!running)fail();p--;status=running;}
   if(status===255){running=0;const type=byte(),length=vlq(),stop=p+length;if(stop>end)fail();if(type===0x51){if(length!==3)fail();const value=byte()*65536+byte()*256+byte();if(!value||(tempo!==null&&tempo!==value))fail();tempo=value;}p=stop;continue;}
   if(status===240||status===247){running=0;const n=vlq();p+=n;if(p>end)fail();continue;}
   if(status<128||status>=240)fail();running=status;const channel=status&15,kind=status>>4,a=byte(),v=(kind===12||kind===13)?0:byte();if(a>127||v>127)fail();
   if(!channels.has(channel))channels.set(channel,{instrument:0,notes:[]});const track=channels.get(channel),key=channel*128+a;
   if(kind===12){if(track.notes.length)fail();track.instrument=a;}
   if(kind===9&&v){if([...active.keys()].some(k=>(k>>7)===channel))fail();active.set(key,{tick,pitch:a,velocity:v});}
   if(kind===8||(kind===9&&!v)){const note=active.get(key);if(!note)fail();const start=Math.round(note.tick*48/division),duration=Math.round((tick-note.tick)*48/division);if(duration<1||duration>255)fail();track.notes.push({...note,tick:start,duration});active.delete(key);}
   if((kind===11&&![0,32,7,10,91,121,123].includes(a))||kind===14||kind===10)fail();
  }
  if(p!==end||active.size)fail();
 }
 if(p!==b.length)fail();const bpm=60000000/(tempo??500000),nativeTempo=Math.round(bpm/MUSIC_TEMPO_BPM);if(nativeTempo<1||nativeTempo>255)fail();
 const tracks=[...channels.entries()].sort((a,b)=>a[0]-b[0]).map(([,t])=>t).filter(t=>t.notes.length);if(!tracks.length||tracks.length>8)fail();return {tempo:nativeTempo,tracks};
}
export function writeMidi(song){
 const ascii=s=>[...s].map(c=>c.charCodeAt(0)),be=(n,size)=>Array.from({length:size},(_,i)=>Math.floor(n/2**((size-i-1)*8))&255);
 const vlq=n=>{if(!Number.isInteger(n)||n<0||n>0xfffffff)throw new Error('Tiempo MIDI fuera de rango.');const a=[n&127];while(n=Math.floor(n/128))a.unshift((n&127)|128);return a;};
 const out=[...ascii('MThd'),0,0,0,6,0,1,...be(song.tracks.length,2),0,48];
 song.tracks.forEach((track,c)=>{
  const data=[],events=[],micro=Math.round(60000000/(song.tempo*MUSIC_TEMPO_BPM));
  if(!c)data.push(0,255,81,3,...be(micro,3));data.push(0,0xc0|c,track.instrument&127);
  for(const n of track.notes){if(n.pitch<0||n.pitch>127)throw new Error('Nota MIDI fuera de rango.');events.push({tick:n.tick,off:false,bytes:[0x90|c,n.pitch,Math.max(1,n.velocity)]},{tick:n.tick+n.duration,off:true,bytes:[0x80|c,n.pitch,0]});}
  events.sort((a,b)=>a.tick-b.tick||Number(b.off)-Number(a.off));let time=0;
  for(const e of events){data.push(...vlq(e.tick-time),...e.bytes);time=e.tick;}data.push(0,255,47,0);out.push(...ascii('MTrk'),...be(data.length,4));for(const v of data)out.push(v);
 });return Uint8Array.from(out);
}
