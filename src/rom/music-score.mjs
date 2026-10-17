import {compileMusic,decodeMusic,editMusicNote} from './music.mjs';
export const REGION_TICKS=768; // Four 4/4 bars at the driver's 48 PPQN.
export const NATIVE_STRUCTURE_REASON='Los patrones nativos comparten comandos y efectos. Usa Dibujar notas para preparar una versión editable; se indicarán los cambios antes de convertir.';
const equal=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
export function isSimpleScore(bytes){try{return equal(bytes,compileMusic(decodeMusic(bytes),decodeMusic(bytes).tracks.length));}catch{return false;}}
export function musicRegions(song){
 return song.tracks.map(track=>{
  const groups=new Map();track.notes.forEach((note,index)=>{const start=Math.floor(note.tick/REGION_TICKS)*REGION_TICKS;if(!groups.has(start))groups.set(start,[]);groups.get(start).push({note,index,channel:track.channel});});
  return {channel:track.channel,instrument:track.instrument,loop:track.loop,length:track.length,regions:[...groups].map(([start,notes])=>({id:`${track.channel}:${start}`,channel:track.channel,start:Math.min(...notes.map(({note})=>note.tick)),end:Math.max(...notes.map(({note})=>note.tick+note.duration)),notes}))};
 });
}
export function noteSelection(song,refs){
 const seen=new Set();return refs.map(({channel,index})=>{const note=song.tracks[channel]?.notes[index],key=`${channel}:${index}`;if(!note||seen.has(key))throw new Error('Selección musical inválida.');seen.add(key);return {channel,index,note};});
}
export function scoreClipboard(bytes,refs){
 const selected=noteSelection(decodeMusic(bytes),refs);if(!selected.length)throw new Error('Selecciona notas o regiones.');
 const start=Math.min(...selected.map(n=>n.note.tick)),channel=Math.min(...selected.map(n=>n.channel));
 return selected.map(n=>({channel:n.channel-channel,note:{tick:n.note.tick-start,duration:n.note.duration,pitch:n.note.pitch,velocity:n.note.velocity}}));
}
// All operations return a validated new byte array. Invalid polyphony, limits,
// or unsupported native structure leave the caller's current draft untouched.
export function editScore(bytes,operation){
 const song=decodeMusic(bytes),selected=noteSelection(song,operation.refs||[]),simple=isSimpleScore(bytes);
 if(!simple){
  if(operation.type!=='modify'||operation.tickDelta||operation.duration!==undefined||operation.durationDelta!==undefined)throw new Error(NATIVE_STRUCTURE_REASON);
  let result=bytes;const offsets=new Set();
  for(const {note} of selected){if(offsets.has(note.offset))continue;offsets.add(note.offset);const values={};
   if(operation.pitchDelta!==undefined)values.pitch=note.pitch+operation.pitchDelta;
   if(operation.pitch!==undefined)values.pitch=operation.pitch;
   if(operation.velocity!==undefined)values.velocity=operation.velocity;
   if(operation.length!==undefined)values.length=operation.length;
   result=editMusicNote(result,note,values);
  }return result;
 }
 const score={tempo:song.tempo,tracks:song.tracks.map(t=>({instrument:t.instrument,notes:t.notes.map(n=>({...n}))}))};
 if(operation.type==='modify')for(const {channel,index} of selected){const n=score.tracks[channel].notes[index];n.tick+=operation.tickDelta||0;n.pitch+=operation.pitchDelta||0;if(operation.pitch!==undefined)n.pitch=operation.pitch;if(operation.velocity!==undefined)n.velocity=operation.velocity;if(operation.duration!==undefined)n.duration=operation.duration;if(operation.durationDelta!==undefined)n.duration+=operation.durationDelta;}
 else if(operation.type==='delete')for(const channel of new Set(selected.map(n=>n.channel))){const remove=new Set(selected.filter(n=>n.channel===channel).map(n=>n.index));score.tracks[channel].notes=score.tracks[channel].notes.filter((_,i)=>!remove.has(i));}
 else if(operation.type==='paste'){
  if(!Array.isArray(operation.clipboard)||!operation.clipboard.length)throw new Error('El portapapeles musical está vacío.');
  for(const item of operation.clipboard){const track=score.tracks[operation.channel+item.channel];if(!track)throw new Error('El MIDI supera los canales disponibles de esta canción.');track.notes.push({...item.note,tick:item.note.tick+operation.tick});}
 }else if(operation.type==='add'){
  const track=score.tracks[operation.channel];if(!track)throw new Error('Selección musical inválida.');track.notes.push({...operation.note});
 }else if(operation.type==='stretch'){
  if(!Number.isFinite(operation.factor)||operation.factor<=0)throw new Error('Valor musical fuera de rango.');
  for(const {channel,index} of selected){const n=score.tracks[channel].notes[index];n.tick=operation.start+Math.round((n.tick-operation.start)*operation.factor);n.duration=Math.max(1,Math.round(n.duration*operation.factor));}
 }else if(operation.type==='tempo')score.tempo=operation.value;
 else if(operation.type==='instrument'){if(!score.tracks[operation.channel])throw new Error('Selección musical inválida.');score.tracks[operation.channel].instrument=operation.value;}
 else throw new Error('Operación musical no compatible.');
 return compileMusic(score,score.tracks.length);
}
export class MusicDraftHistory {
 constructor(limit=80){this.limit=limit;this.undoStack=[];this.redoStack=[];}
 reset(){this.undoStack=[];this.redoStack=[];}
 commit(current,next){if(equal(current,next))return false;this.undoStack.push(current.slice());if(this.undoStack.length>this.limit)this.undoStack.shift();this.redoStack=[];return true;}
 undo(current){if(!this.undoStack.length)return current;this.redoStack.push(current.slice());return this.undoStack.pop();}
 redo(current){if(!this.redoStack.length)return current;this.undoStack.push(current.slice());return this.redoStack.pop();}
}
