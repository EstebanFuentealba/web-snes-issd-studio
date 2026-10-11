// ISSDeluxeEditor/Form1.cs: twelve 15-byte records following DATA_8BFCE0.
import {teamCount,teamExists} from './team-count.mjs';
// Offsets refer to the unheadered USA ROM; RomProject handles copier headers.
export const SCENARIO_OFFSET = 0x5fcf8;
export const SCENARIO_COUNT = 12;
export const SCENARIO_SIZE = 15;
// DATA_81DF81: CODE_8AA521 masks unused stars using this byte per scenario.
export const SCENARIO_DIFFICULTY_OFFSET = 0xdf81;
export const SCENARIO_DIFFICULTY_RULES = Array.from({length:SCENARIO_COUNT},(_,i)=>[
  `scenario-difficulty:${i}`, SCENARIO_DIFFICULTY_OFFSET+i, 1,
]);
export function validateScenarioDifficulty(bytes) {
  if(bytes.length!==1||bytes[0]<1||bytes[0]>5)throw new Error('Dificultad de escenario fuera de rango.');
}
export function scenarioDifficultyPatch(index,value) {
  ruleFor(index);
  if(!Number.isInteger(value)||value<1||value>5)throw new Error('Dificultad de escenario fuera de rango.');
  return {id:`scenario-difficulty:${index}`,offset:SCENARIO_DIFFICULTY_OFFSET+index,bytes:Uint8Array.of(value),label:`SCENARIO ${index+1} ★`};
}
export const SCENARIO_RULES = Array.from({length:SCENARIO_COUNT},(_,i)=>[
  `scenario:${i}`, SCENARIO_OFFSET+i*SCENARIO_SIZE, SCENARIO_SIZE,
]);
export const SCENARIO_WEATHER = [[0,'Ninguno'],[1,'Día'],[2,'Despejado'],[3,'Noche'],[4,'Día despejado'],[6,'Lluvia'],[8,'Nieve'],[10,'Noche despejada']];
export const SCENARIO_STADIUMS = ['Japan','U.S.A.','Spain','Italy','England','Germany','Brazil','Nigeria'];
export const SCENARIO_STARTS = [[8,'Saque de meta'],[16,'Saque de esquina'],[134,'Tiro libre rival'],[144,'Tiro libre del jugador']];
const fields = {seconds:2,minutes:3,playerTeam:4,opponentTeam:5,playerGoals:6,opponentGoals:7,weather:8,stadium:9,start:10,ballX:11,x:12,ballY:13,y:14};
const bcd = value => (value>>>4)*10+(value&15);
const encodeBcd = value => Math.floor(value/10)*16+value%10;
function ruleFor(index) {
  if(!Number.isInteger(index)||index<0||index>=SCENARIO_COUNT)throw new Error('Escenario inválido.');
  return SCENARIO_RULES[index];
}
export function readScenarios(rom) {
  if(rom.length<SCENARIO_OFFSET+SCENARIO_COUNT*SCENARIO_SIZE)throw new Error('Tabla de escenarios incompleta.');
  return SCENARIO_RULES.map(([id,offset],index)=>{
    const bytes=rom.slice(offset,offset+SCENARIO_SIZE),scenario={id,index,offset,bytes,difficulty:rom[SCENARIO_DIFFICULTY_OFFSET+index],difficultyId:`scenario-difficulty:${index}`};
    for(const [key,position] of Object.entries(fields))scenario[key]=key==='seconds'?bcd(bytes[position]):key.endsWith('Team')?bytes[position]/2:bytes[position];
    return scenario;
  });
}
function valid(key,value,limit=42) {
  if(!Number.isInteger(value)||value<0)return false;
  if(key==='seconds')return value<=59;
  if(key==='minutes')return value<=9;
  if(key.endsWith('Team'))return value<limit;
  if(key.endsWith('Goals'))return value<=10;
  if(key==='weather')return SCENARIO_WEATHER.some(([id])=>id===value);
  if(key==='stadium')return value<SCENARIO_STADIUMS.length;
  return value<=255;
}
export function validateScenarioBytes(bytes,original,limit=42) {
  if(bytes.length!==SCENARIO_SIZE||original.length!==SCENARIO_SIZE)throw new Error('Tamaño de escenario inválido.');
  // The first word is an opaque game field. Preserve it and unknown stock values.
  if(bytes[0]!==original[0]||bytes[1]!==original[1])throw new Error('Cabecera de escenario alterada.');
  for(const [key,position] of Object.entries(fields)){
    if(bytes[position]===original[position])continue;
    const raw=bytes[position],value=key==='seconds'?bcd(raw):key.endsWith('Team')?raw/2:raw;
    if(!valid(key,value,limit)||(key==='seconds'&&((raw&15)>9||(raw>>>4)>5)))throw new Error('Valor de escenario fuera de rango.');
  }
}
export function scenarioPatch(rom,index,changes) {
  const [id,offset]=ruleFor(index),bytes=rom.slice(offset,offset+SCENARIO_SIZE);
  for(const [key,value] of Object.entries(changes)){
    if(!(key in fields)||!valid(key,value,teamCount(rom))||(key.endsWith('Team')&&!teamExists(rom,value)))throw new Error('Valor de escenario fuera de rango.');
    bytes[fields[key]]=key==='seconds'?encodeBcd(value):key.endsWith('Team')?value*2:value;
  }
  validateScenarioBytes(bytes,rom.slice(offset,offset+SCENARIO_SIZE),teamCount(rom));
  return {id,offset,bytes,label:`SCENARIO ${index+1}`};
}
