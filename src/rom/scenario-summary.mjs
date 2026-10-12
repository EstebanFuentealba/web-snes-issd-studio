import {externalDeluxeLayout} from './external-layout.mjs';
import {wc26TeamName} from './wc26-data.mjs';
import {scenarioRestart} from './scenario-position.mjs';
import {word,loRom} from './binary.mjs';
import {readScenarios} from './scenarios.mjs';
import {DELUXE_TEAMS} from './deluxe.mjs';
import {hasPhysicalTeams} from './team-count.mjs';
import {frameText} from './team-labels.mjs';
// CODE_8AA5A3: DATA_87EE21 -> CODE_858B3A ($021C = 2 rows x 28).
const BASE=loRom(0x87ee3b),TABLE=loRom(0x87ee21),WIDTH=28,SIZE=56;
export const SCENARIO_SUMMARY_RULES=Array.from({length:12},(_,i)=>[`scenario-summary:${i}`,BASE+i*SIZE,SIZE]);
const glyphs=new Map([[' ',0],['.',0x54],['-',0x57],["'",0x5a],[':',0x5c]]);
Array.from('0123456789', (c,i)=>glyphs.set(c,0x5e+i));
Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ', (c,i)=>glyphs.set(c,0x68+i));
const letters=new Map([...glyphs].map(([c,b])=>[b,c]));
const same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
function ruleFor(rom,index){
  const rule=SCENARIO_SUMMARY_RULES[index];
  if(!Number.isInteger(index)||!rule||word(rom,TABLE+index*2)!==0xee3b+index*SIZE)throw new Error('Rótulo de escenario no compatible.');
  return rule;
}
export function readScenarioSummary(rom,index){
  const [id,offset]=ruleFor(rom,index),bytes=rom.slice(offset,offset+SIZE);
  return {id,offset,bytes,lines:[0,1].map(row=>Array.from(bytes.slice(row*WIDTH,(row+1)*WIDTH),b=>letters.get(b)??'�').join('').trimEnd())};
}
function teamName(index,rom){
  if(externalDeluxeLayout(rom))return wc26TeamName(rom,index);
  if(rom&&(hasPhysicalTeams(rom)||index>=42)){const text=frameText(rom,index);if(text)return text;}
  return ({15:'SWITZERLAND',22:'CZECH.REP.',36:'WORLD STARS',37:'EURO A',38:'EURO B',39:'ASIA STARS',40:'AFRICA STARS',41:'AMERICA STARS'})[index]||DELUXE_TEAMS[index]?.toUpperCase()||'TEAM';
}
function fitNames(names,limit){
  names=names.slice();while(names.join('').length>limit){const i=names[0].length>=names[1].length?0:1;names[i]=names[i].slice(0,-1);}
  return names;
}
export function scenarioSummaryPatch(original,current,index){
  const stock=readScenarioSummary(original,index);ruleFor(current,index);
  const before=readScenarios(original)[index],after=readScenarios(current)[index],lines=stock.lines.slice();
  if(['playerTeam','opponentTeam','playerGoals','opponentGoals'].some(k=>before[k]!==after[k])){
    const prefix=`NO.${index+1}`.padEnd(6,' '),score=`${after.playerGoals}-${after.opponentGoals}`;
    const [player,opponent]=fitNames([teamName(after.playerTeam,current),teamName(after.opponentTeam,current)],WIDTH-prefix.length-score.length-2);
    lines[0]=`${prefix}${player} ${score} ${opponent}`;
  }
  if(['minutes','seconds','playerTeam','opponentTeam','start','ballX','x','ballY','y'].some(k=>before[k]!==after[k])){
    const time=`${after.minutes}:${String(after.seconds).padStart(2,'0')}`;
    // Preserve native special cases such as Turkey's THROW IN when the
    // start byte is unchanged. Advanced start values have no known label.
    const restartChanged=scenarioRestart(before)!==scenarioRestart(after);
    const action=before.start===after.start&&!restartChanged?stock.lines[1].split("'S ")[1]:({goal:'G.K.',corner:'C.K.',throw:'THROW IN'})[scenarioRestart(after)]||({134:'F.K.',144:'F.K.'})[after.start];
    const ownerIndex=after.start===134?after.opponentTeam:after.playerTeam;
    let owner=teamName(ownerIndex,current);
    const suffix=action?`'S ${action}`:'',prefix=`      ${time} `;
    const available=WIDTH-prefix.length-suffix.length;
    if(owner.length>available){owner=({15:'SWISS',36:'WORLD',39:'ASIA',40:'AFRICA',41:'AMERICA'})[ownerIndex]||owner;if(owner.length>available)owner=owner.slice(0,available-1)+'.';}
    lines[1]=action?`${prefix}${owner}${suffix}`:`${prefix}START ${after.start}`;
  }
  const bytes=Uint8Array.from(Array.from(lines.map(line=>line.padEnd(WIDTH,' ')).join(''),c=>glyphs.get(c)));
  if(bytes.length!==SIZE||lines.some(line=>line.length>WIDTH))throw new Error('Rótulo de escenario no compatible.');
  // Restoring the data restores the exact original label, including padding.
  return {id:stock.id,offset:stock.offset,bytes:same(bytes,stock.bytes)?stock.bytes:bytes,label:`Rótulo SCENARIO ${index+1}`};
}
export function validateScenarioSummary(bytes){
  if(bytes.length!==SIZE||bytes.some(b=>!letters.has(b)))throw new Error('Rótulo de escenario no compatible.');
}
