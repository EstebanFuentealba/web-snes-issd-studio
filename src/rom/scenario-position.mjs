import {word} from './binary.mjs';
// CODE_8BDA6A reads offsets +$0B and +$0D as whole little-endian words.
// DATA_81EC47 supplies field length and width for each stadium.
const sizes=[[0x700,0x240],[0x740,0x280],[0x7c0,0x2c0],[0x800,0x280],[0x780,0x280],[0x780,0x240],[0x700,0x2c0],[0x880,0x2c0]];
const signed=word=>word&0x8000?word-0x10000:word;
export function scenarioPosition(scenario) {
  return {x:signed(scenario.ballX|scenario.x<<8),y:signed(scenario.ballY|scenario.y<<8)};
}
export function scenarioPitchSize(stadium,rom) {
  if(rom&&Number.isInteger(stadium)&&stadium>=0&&stadium<8)return {length:word(rom,0xec47+stadium*4),width:word(rom,0xec49+stadium*4)};
  const [length,width]=sizes[stadium]||sizes[0];return {length,width};
}
export function scenarioPositionChanges(x,y) {
  if(![x,y].every(v=>Number.isInteger(v)&&v>=-32768&&v<=32767))throw new Error('Posición de escenario fuera de rango.');
  return {ballX:x&255,x:(x>>8)&255,ballY:y&255,y:(y>>8)&255};
}
export function positionOnPitch(point,stadium,rom) {
  const {length,width}=scenarioPitchSize(stadium,rom);
  return {x:Math.round(Math.max(0,Math.min(1,point.x))*length),y:Math.round(Math.max(0,Math.min(1,point.y))*width)};
}
// Native scenarios share start $10 between corners, goal kicks and throw-ins.
// The ball's side of the field distinguishes these restarts; keep stock cases.
export function scenarioRestart(scenario,rom) {
  if(scenario.start===8)return 'goal';
  if(scenario.start!==16)return null;
  const p=scenarioPosition(scenario),size=scenarioPitchSize(scenario.stadium,rom);
  if(p.x>=0&&p.x<=size.length&&(p.y<0||p.y>size.width))return 'throw';
  return p.x<0?'goal':'corner';
}
export function scenarioAutomaticPosition(scenario,rom) {
  const kind=scenarioRestart(scenario,rom);
  if(kind!=='goal'&&kind!=='corner')return null;
  const p=scenarioPosition(scenario),size=scenarioPitchSize(scenario.stadium,rom),right=p.x>=size.length/2,bottom=p.y>=size.width/2;
  // CODE_80ED25 places goal kicks 128 units from the goal line and
  // 96 units above / below the field's centre. CODE_80ECB4 uses DATA_819A62.
  if(kind==='goal')return {x:right?size.length-128:128,y:size.width/2+(bottom?96:-96)};
  const offsets=[[4,4],[8,-4],[-8,4],[-4,-4]],[dx,dy]=offsets[(right?2:0)+(bottom?1:0)];
  return {x:(right?size.length:0)+dx,y:(bottom?size.width:0)+dy};
}
export function scenarioStartChanges(scenario,changes,rom) {
  const next={...scenario,...changes},kind=scenarioRestart(scenario,rom);
  const requested=Object.hasOwn(changes,'start')?changes.start:null;
  if((requested===134||requested===144)&&scenarioAutomaticPosition(scenario,rom)){const p=scenarioAutomaticPosition(scenario,rom);return {...changes,...scenarioPositionChanges(p.x,p.y)};}
  if(requested!==8&&requested!==16&&!(Object.hasOwn(changes,'stadium')&&(kind==='goal'||kind==='corner')))return changes;
  const size=scenarioPitchSize(next.stadium,rom),previous=scenarioPosition(scenario),oldSize=scenarioPitchSize(scenario.stadium,rom);
  const restart=requested===8?'goal':requested===16?'corner':kind;
  const same=restart===kind,right=same?previous.x>=oldSize.length/2:restart==='corner',bottom=same?previous.y>=oldSize.width/2:false;
  // The game resolves the restart from the initial out-of-field position.
  // Use a one-unit trigger beyond the goal line, matching native scenarios.
  const x=right?size.length+1:-1,y=restart==='corner'?(bottom?size.width:0):size.width/2+(bottom?96:-96);
  return {...changes,...scenarioPositionChanges(x,y)};
}
