import {externalDeluxeLayout} from './external-layout.mjs';
import {teamExists,attributeOffset} from './team-count.mjs';
import { word, loRom } from './binary.mjs';
import { deluxeAttributes, deluxePlayerNameOffset } from './deluxe.mjs';
export const POSITIONS={1:'Portero',2:'Defensa',3:'Medio defensivo',4:'Mediocampo',5:'Medio ofensivo',6:'Delantero'};
export const STATS=['acceleration','speed','shotPower','curl','balance','intelligence','dribbling','jump','energy'];
export function encodeName(name,length=8) {
  if(typeof name!=='string' || !name.trim() || name.length>length) throw new Error(`El nombre admite entre 1 y ${length} caracteres.`);
  const bytes=new Uint8Array(length);
  Array.from(name).forEach((c,i)=> {
    if(c>='A' && c<='Z') bytes[i]=c.charCodeAt(0)-65+0x68;
    else if(c>='a' && c<='z') bytes[i]=c.charCodeAt(0)-97+0x82;
    else if(Object.hasOwnProperty.call({' ':0,'.':0x54,...(length===10?{'-':0x57}:{}),'"':0x56,"'":0x5c,'/':0x5f},c)) bytes[i]={' ':0,'.':0x54,...(length===10?{'-':0x57}:{}),'"':0x56,"'":0x5c,'/':0x5f}[c];
    else throw new Error(`El juego no admite el carácter «${c}». Usa letras sin acentos, espacio, punto, comillas o /.`);
  });return bytes;
}
export function playerOffsets(rom,team,index) {
  if(!teamExists(rom,team)||!Number.isInteger(index)||index<0||index>=20) throw new Error('Jugador inválido.');
  return {name:deluxePlayerNameOffset(rom,team,index),attributes:attributeOffset(rom,team,index)};
}
export function playerPatches(rom,team,index,changes,swapNumber=true) {
  const offsets=playerOffsets(rom,team,index), patches=[];
  if(changes.name!==undefined) patches.push({id:`name:${offsets.name}`,label:`Nombre · equipo ${team+1}, jugador ${index+1}`,offset:offsets.name,bytes:encodeName(changes.name,externalDeluxeLayout(rom)?.nameLength||8)});
  const keys=['acceleration','speed','shotPower','curl','balance','intelligence','dribbling','jump','position','energy'];
  const bytes=rom.slice(offsets.attributes,offsets.attributes+7), current=deluxeAttributes(bytes);
  for(const [key,value] of Object.entries(changes)) {
    if(key==='name') continue;
    const max=key==='no'?20:key==='position'?6:key==='hair'?13:key==='skin'?1:10, min=['hair','skin'].includes(key)?0:1;
    if(![...keys,'no','hair','skin'].includes(key)||!Number.isInteger(value)||value<min||value>max) throw new Error(`Valor de ${key} inválido (${min}–${max}).`);
    current[key]=value;
    const nibble=keys.indexOf(key);
    if(nibble>=0) {const shift=nibble%2?0:4;bytes[nibble>>>1]=(bytes[nibble>>>1]&~(15<<shift))|((value-(key==='position'?0:1))<<shift);}
    if(key==='no') bytes[5]=value-1;
    if(key==='hair') bytes[6]=(bytes[6]&0xf0)|value;
    if(key==='skin') bytes[6]=(bytes[6]&15)|(value<<4);
  }
  if(Object.keys(changes).some(k=>k!=='name')) patches.push({id:`attributes:${offsets.attributes}`,label:`Atributos · equipo ${team+1}, jugador ${index+1}`,offset:offsets.attributes,bytes});
  if(swapNumber && changes.no!==undefined && changes.no!==rom[offsets.attributes+5]+1) {
    for(let i=0;i<20;i++) {
      const other=playerOffsets(rom,team,i).attributes;
      if(i!==index && rom[other+5]===changes.no-1) {
        const bytes=rom.slice(other,other+7);bytes[5]=rom[offsets.attributes+5];
        patches.push({id:`attributes:${other}`,label:`Intercambio dorsal · equipo ${team+1}, jugador ${i+1}`,offset:other,bytes});break;
      }
    }
  }
  return patches;
}
