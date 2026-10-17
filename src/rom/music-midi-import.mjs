import {MUSIC_TEMPO_BPM,compileMusic} from './music.mjs';
import {compress} from './graphics.mjs';
const invalid=()=>{throw new Error('Archivo MIDI inválido o truncado.');};
// Parse SMF independently of the SPC voice/storage budget. Channel events from
// separate SMF tracks are merged before pairing notes and applying sustain.
export function parseMidi(input){
 const b=new Uint8Array(input);if(b.length>2000000)invalid();let p=0,end=b.length;
 const byte=()=>{if(p>=end)invalid();return b[p++];},u16=()=>byte()*256+byte(),u32=()=>u16()*65536+u16(),tag=()=>String.fromCharCode(byte(),byte(),byte(),byte());
 const vlq=()=>{let n=0;for(let i=0;i<4;i++){const v=byte();n=n*128+(v&127);if(v<128)return n;}invalid();};
 if(tag()!=='MThd')invalid();const header=u32();if(header<6||header>1024)invalid();const format=u16(),count=u16(),division=u16();if(format>1||!count||count>128||!division||(division&32768)||(format===0&&count!==1))throw new Error('MIDI no compatible: usa formato 0/1 con división métrica.');p+=header-6;
 const events=[],names=new Map();let lastTick=0,ignored=0;
 for(let track=0;track<count;track++){
  end=b.length;if(tag()!=='MTrk')invalid();const size=u32();end=p+size;if(end>b.length)invalid();let tick=0,running=0,name='';const channels=new Set();
  while(p<end){if(events.length>100000)invalid();tick+=vlq();if(tick>0xfffffff)invalid();let status=byte();if(status<128){if(!running)invalid();p--;status=running;}
   if(status===255){const type=byte(),length=vlq(),stop=p+length;if(stop>end)invalid();if(type===0x51){if(length!==3)invalid();const micro=byte()*65536+byte()*256+byte();if(!micro)invalid();events.push({tick,kind:'tempo',micro,order:events.length});}else if(type===3){name=String.fromCharCode(...b.subarray(p,Math.min(stop,p+120)));}p=stop;continue;}
   if(status===240||status===247){running=0;const length=vlq();p+=length;if(p>end)invalid();ignored++;continue;}
   if(status<128||status>=240)invalid();running=status;const channel=status&15,kind=status>>4,a=byte(),v=kind===12||kind===13?0:byte();if(a>127||v>127)invalid();channels.add(channel);events.push({tick,channel,kind,a,v,order:events.length});
  }
  for(const channel of channels)if(name&&!names.has(channel))names.set(channel,name);lastTick=Math.max(lastTick,tick);
 }
 if(p!==b.length)invalid();events.sort((a,b)=>a.tick-b.tick||a.order-b.order);
 const channels=new Map(),tempos=[],active=new Map(),held=new Map(),sustain=new Set(),programs=new Map();let unmatched=0;
 const finish=(note,tick)=>{const duration=Math.max(1,Math.round((tick-note.rawTick)*48/division));const row=channels.get(note.channel);row.notes.push({...note,tick:Math.round(note.rawTick*48/division),duration});};
 for(const event of events){const {tick,channel,kind,a,v}=event;if(kind==='tempo'){tempos.push({tick:tick*48/division,micro:event.micro});continue;}
  if(!channels.has(channel))channels.set(channel,{id:channel,name:names.get(channel)||'',program:0,percussion:channel===9,notes:[]});const row=channels.get(channel),key=channel*128+a;
  if(kind===12){programs.set(channel,a);row.program=a;continue;}
  if(kind===9&&v){const note={rawTick:tick,pitch:a,velocity:v,channel,program:programs.get(channel)||0};if(!active.has(key))active.set(key,[]);active.get(key).push(note);continue;}
  if(kind===8||(kind===9&&!v)){const queue=active.get(key),note=queue?.shift();if(!note){ignored++;continue;}if(sustain.has(channel)){if(!held.has(channel))held.set(channel,[]);held.get(channel).push(note);}else finish(note,tick);continue;}
  if(kind===11&&a===64){if(v>=64)sustain.add(channel);else{sustain.delete(channel);for(const note of held.get(channel)||[])finish(note,tick);held.delete(channel);}continue;}
  if(kind===11&&(a===120||a===123)){for(const [key,queue] of active)if((key>>7)===channel){for(const note of queue)finish(note,tick);active.delete(key);}for(const note of held.get(channel)||[])finish(note,tick);held.delete(channel);continue;}
  ignored++;
 }
 for(const queue of active.values())for(const note of queue){finish(note,lastTick);unmatched++;}for(const notes of held.values())for(const note of notes)finish(note,lastTick);
 const rows=[...channels.values()].filter(c=>c.notes.length).sort((a,b)=>a.id-b.id);if(!rows.length)throw new Error('El MIDI no contiene notas.');
 for(const row of rows){row.notes.sort((a,b)=>a.tick-b.tick||b.pitch-a.pitch);const edges=row.notes.flatMap(n=>[[n.tick,1],[n.tick+n.duration,-1]]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let level=0;row.polyphony=0;for(const [,delta] of edges){level+=delta;row.polyphony=Math.max(row.polyphony,level);}}
 return {channels:rows,tempos,duration:Math.ceil(lastTick*48/division),notes:rows.reduce((n,c)=>n+c.notes.length,0),ignored,unmatched};
}
export function defaultMidiVoices(parsed,count){
 const voices=parsed.channels.map(()=>0),priority=parsed.channels.map((c,i)=>({i,rank:c.percussion?0:c.program>=32&&c.program<=39?1:2})).sort((a,b)=>a.rank-b.rank||a.i-b.i);
 for(const {i} of priority.slice(0,count))voices[i]=1;
 for(let used=voices.reduce((a,b)=>a+b,0);used<count;used++){const next=priority.filter(({i})=>voices[i]&&voices[i]<parsed.channels[i].polyphony).sort((a,b)=>parsed.channels[b.i].polyphony/voices[b.i]-parsed.channels[a.i].polyphony/voices[a.i])[0];if(!next)break;voices[next.i]++;}return voices;
}
export function convertMidi(parsed,{channels,capacity,startBar=1,bars=8,voices=defaultMidiVoices(parsed,channels),instruments=parsed.channels.map(()=>1)}={}){
 if(!Number.isInteger(channels)||channels<1||channels>8||!Number.isInteger(startBar)||startBar<1||!Number.isInteger(bars)||bars<1||bars>256||voices.length!==parsed.channels.length||voices.some(n=>!Number.isInteger(n)||n<0)||voices.reduce((a,b)=>a+b,0)>channels||!voices.some(Boolean))throw new Error('La distribución de voces supera los canales disponibles.');
 const start=(startBar-1)*192,end=start+bars*192,initial=parsed.tempos.filter(t=>t.tick===0).at(-1)?.micro||500000,bpm=60000000/initial,tempo=Math.max(1,Math.min(255,Math.round(bpm/MUSIC_TEMPO_BPM))),targetBpm=tempo*MUSIC_TEMPO_BPM;
 const tempos=[{tick:0,micro:500000},...parsed.tempos].sort((a,b)=>a.tick-b.tick);let time=0;for(let i=0;i<tempos.length;i++){if(i)time+=(tempos[i].tick-tempos[i-1].tick)*tempos[i-1].micro/48000000;tempos[i].seconds=time;}
 const seconds=tick=>{let event=tempos[0];for(const t of tempos){if(t.tick>tick)break;event=t;}return event.seconds+(tick-event.tick)*event.micro/48000000;},origin=seconds(start),tracks=[];let selected=0,omitted=0,split=0,shifted=0;
 parsed.channels.forEach((row,index)=>{const instrument=instruments[index];if(!Number.isInteger(instrument)||instrument<0||instrument>29)throw new Error('Valor musical fuera de rango.');const lanes=Array.from({length:voices[index]},()=>({instrument,notes:[],end:0}));
  const notes=row.notes.filter(n=>n.tick<end&&n.tick+n.duration>start);selected+=notes.length;
  for(const note of notes){const tick=Math.max(0,Math.round((seconds(Math.max(start,note.tick))-origin)*targetBpm*48/60)),stop=Math.max(tick+1,Math.round((seconds(Math.min(end,note.tick+note.duration))-origin)*targetBpm*48/60)),lane=lanes.filter(l=>l.end<=tick).sort((a,b)=>(a.notes.at(-1)?.pitch===note.pitch?-1:0)-(b.notes.at(-1)?.pitch===note.pitch?-1:0)||b.end-a.end)[0];if(!lane){omitted++;continue;}
   let pitch=note.pitch;if(pitch>95)shifted++;while(pitch>95)pitch-=12;let remaining=stop-tick,at=tick;if(remaining>255)split++;while(remaining){const duration=Math.min(255,remaining);lane.notes.push({tick:at,duration,pitch,velocity:note.velocity});remaining-=duration;at+=duration;}lane.end=stop;
  }tracks.push(...lanes.map(({instrument,notes})=>({instrument,notes})));
 });
 if(!selected||!tracks.some(t=>t.notes.length))throw new Error('El fragmento elegido no contiene notas.');
 const song={tempo,tracks};let bytes;try{bytes=compileMusic(song,channels);}catch(error){if(error.message==='Secuencia musical inválida.')throw new Error('El fragmento supera el espacio de la canción. Reduce los compases o las voces.');throw error;}const size=compress(bytes).length;if(capacity&&size>capacity)throw new Error('El fragmento supera el espacio de la canción. Reduce los compases o las voces.');
 return {bytes,size,selected,omitted,split,shifted,tempo,targetBpm,tempoChanges:new Set(parsed.tempos.map(t=>t.micro)).size>1,ignored:parsed.ignored,unmatched:parsed.unmatched};
}
