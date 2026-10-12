import {externalDeluxeLayout} from './external-layout.mjs';
import {loRom,word,decompress,tiles,palette} from './binary.mjs';
// WC26's repacked large font. These glyphs were verified by rendering its
// source atlas, including paired letters and the packed ZE/CH/REP/D.R. glyphs.
const GLYPHS = {
  "140:8": "S",
  "192:16": "PA",
  "474:16": "IN",
  "201:16": "GE",
  "160:8": "R",
  "167:16": "MA",
  "137:8": "N",
  "228:8": "Y",
  "163:16": "HO",
  "131:8": "L",
  "131:16": "LA",
  "137:16": "ND",
  "206:16": "S.",
  "231:8": "K",
  "164:16": "OR",
  "130:8": "E",
  "132:8": "A",
  "136:16": "EN",
  "201:8": "G",
  "142:8": "U",
  "140:16": "ST",
  "203:16": "IA",
  "192:8": "P",
  "141:8": "T",
  "233:8": "W",
  "138:16": "DE",
  "225:16": "FR",
  "168:16": "AN",
  "173:16": "CE",
  "135:16": "ME",
  "234:8": "X",
  "170:8": "I",
  "133:16": "CO",
  "129:16": "BE",
  "200:16": "LG",
  "135:8": "M",
  "141:16": "TU",
  "199:16": "AL",
  "128:8": "J",
  "235:8": "Z",
  "229:16": "AR",
  "193:16": "AB",
  "226:16": "RA",
  "227:16": "AY",
  "142:16": "U.",
  "172:16": "EC",
  "138:8": "D",
  "230:16": "RK",
  "133:8": "C",
  "464:16": "ZE",
  "466:16": "CH",
  "468:16": "REP",
  "194:16": "BO",
  "143:8": ".",
  "478:16": "IV",
  "163:8": "H",
  "129:8": "B",
  "170:16": "IL",
  "196:16": "TI",
  "134:16": "OM",
  "160:16": "RO",
  "476:16": "AT",
  "198:16": "CA",
  "475:16": "NA",
  "161:16": "OC",
  "224:16": "AF",
  "473:16": "RI",
  "205:8": "Q",
  "470:16": "CA",
  "134:8": "O",
  "169:16": "NI",
  "232:8": "V",
  "174:16": "ER",
  "472:16": "D.R.",
  "162:16": "CH",
  "171:16": "LE",
};
function layout(rom){const p=externalDeluxeLayout(rom);if(!p)throw new Error('Perfil WC26 no compatible.');return p;}
export function wc26LargeNames(rom){
  const profile=layout(rom),data=decompress(rom,loRom(profile.largeNames)),frames=data[0],sprites=word(data,1),base=3+frames;
  if(frames!==58||data.length!==base+sprites*4||data.slice(3,base).reduce((n,v)=>n+v,0)!==sprites)throw new Error('Directorio de nombres WC26 no compatible.');
  return {data,frames,sprites,base};
}
function frame(rom,index){
  const p=layout(rom),l=wc26LargeNames(rom);if(!Number.isInteger(index)||index<0||index>=p.teams)throw new Error('Equipo inválido.');
  let start=0;for(let i=0;i<index;i++)start+=l.data[3+i];
  if(word(rom,loRom(p.largeNameDirectory)+index*2)!==0x4f02+start*2)throw new Error('Referencia de nombre WC26 no compatible.');
  return {...l,start,count:l.data[3+index]};
}
export function wc26TeamName(rom,index){
  const l=frame(rom,index),letters=[];
  for(let i=0;i<l.count;i++){
    const pos=l.base+l.start+i,attr=l.data[pos+l.sprites*3],size=attr&16?16:8;
    if(size===8&&l.data[pos+l.sprites]!==4)continue; // lower half of an 8×16 letter
    const id=l.data[pos+l.sprites*2]+((attr&1)<<8),text=GLYPHS[`${id}:${size}`];
    if(!text)throw new Error(`Glifo WC26 desconocido: ${id}.`);
    letters.push({x:l.data[pos]-(size===16?4:0),text});
  }
  const name=letters.sort((a,b)=>a.x-b.x).map(l=>l.text).join('');
  return ({CZECHREP:'CZECH REP',COSTARICA:'COSTA RICA'})[name]||name;
}
export function wc26BigLabel(rom,index){
  const l=frame(rom,index),bytes=new Uint8Array(512*32);
  bytes.set(decompress(rom,loRom(0x9de13c)),128*32);bytes.set(decompress(rom,loRom(0x8781a8)),464*32);
  const font=tiles(bytes,4,16),matrix=Array.from({length:24},()=>Array(80).fill(0));
  for(let i=0;i<l.count;i++){
    const p=l.base+l.start+i,attr=l.data[p+l.sprites*3],size=attr&16?16:8,id=l.data[p+l.sprites*2],x0=l.data[p]-(size===16?4:0),y0=l.data[p+l.sprites]-(size===16?4:0);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const tile=id+((attr&1)<<8)+(x>>3)+(y>>3)*16;
      if(!matrix[y0+y]||x0+x<0||x0+x>=80)continue;
      const color=font[(tile>>4)*8+y%8]?.[(tile&15)*8+x%8];if(color)matrix[y0+y][x0+x]=color;
    }
  }
  const colors=Array(16).fill('transparent');colors.splice(1,11,...palette(rom,loRom(0x89e362),11));return {matrix,colors};
}
export function wc26Palette(rom,index,table,count){
  const profile=layout(rom),pointer=word(rom,(profile.paletteTables[table]??table)+index*2);
  if(!pointer)return null;const offset=loRom(0x890000|pointer);
  if(word(rom,offset)!==count*2-1)throw new Error('Tamaño de paleta WC26 no compatible.');
  return {offset:offset+2,colors:palette(rom,offset+2,count),bytes:rom.slice(offset+2,offset+2+count*2)};
}
// The menu preloads eleven sprite colors at CGRAM $81 before uploading each
// team's four flag colors at $8C (and the equivalent subsequent sprite rows).
// WC26 flags also use the shared yellow/red inks at indices 5 and 6.
export function wc26FlagColors(rom,index){
  layout(rom);
  const offset=loRom(0x89e2be);
  if(word(rom,offset)!==21)throw new Error('Paleta compartida de banderas WC26 no compatible.');
  return ['transparent',...palette(rom,offset+2,11),...wc26Palette(rom,index,0xe7d8,4).colors];
}
export function wc26TeamPresentation(rom,index){
  const p=layout(rom),colors=wc26FlagColors(rom,index);
  const flag=[0,1].flatMap(part=>{
    const offset=loRom(p.flagBank<<16|word(rom,p.flagTable+index*4+part*2)),bytes=decompress(rom,offset);
    if(bytes.length!==96)throw new Error('Bandera WC26 no compatible.');return tiles(bytes,4,3);
  });
  const label=decompress(rom,loRom(p.labelBank<<16|word(rom,p.labelTable+index*2)));
  if(![64,128].includes(label.length))throw new Error('Rótulo WC26 no compatible.');
  return {name:wc26TeamName(rom,index),flag,colors,teamMatrix:tiles(label,2,4),teamColors:['transparent','#ffffff','#b8b8b8','#555555'],bigLabel:wc26BigLabel(rom,index),
    kits:{home:wc26Palette(rom,index,0x1027a,16),away:wc26Palette(rom,index,0x102d0,16),goalkeeper:wc26Palette(rom,index,0x10326,11),skin:wc26Palette(rom,index,0x1037c,5),hair:wc26Palette(rom,index,0x103d2,1)}};
}
export function wc26Groups(rom){
  const p=layout(rom),ids=Array.from(rom.slice(p.groups,p.groups+p.teams),id=>id/2);
  if(new Set(ids).size!==p.teams||ids.some(id=>!Number.isInteger(id)||id<0||id>=p.teams))throw new Error('Grupos WC26 no compatibles.');
  return Array.from({length:p.teams/p.groupSize},(_,index)=>({index,teams:ids.slice(index*p.groupSize,(index+1)*p.groupSize),tournament:index<12}));
}
