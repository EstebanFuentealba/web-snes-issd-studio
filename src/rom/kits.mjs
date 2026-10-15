import {spriteResource} from './graphics.mjs';
import {word,palette,loRom} from './binary.mjs';
import {teamPointer,teamPaletteOffset} from './team-count.mjs';
export function kitSections(rom,team,table){
 const pointer=teamPointer(rom,table,team);if(!pointer)return [];
 const offset=teamPaletteOffset(rom,pointer)+2,count=(word(rom,offset-2)+1)/2,colors=palette(rom,offset,count);
 const specs=table===0x10326?[['Pelo',[0]],['Piel',[1,2,3,4,5]],['Camiseta',[6,7,8]],['Pantalón y medias',[9,10]]]:[0x1027a,0x102d0].includes(table)?[['Pelo',[1]],['Piel',[2,3,4,5,6]],['Camiseta',[7,8,9]],['Pantalón',[10,11,12]],['Medias',[13,14]],['Botines',[15]]]:[['Paleta',Array.from({length:count},(_,i)=>i)]];
 return specs.map(([label,indices])=>({label,colors:indices.filter(i=>i<count).map(index=>({index,offset:offset+index*2,color:colors[index]}))}));
}

// Native NUMBER/PRESET/EDIT DMA descriptors provide eight directions per role.
export function kitDrawingMask(resource,zone='all',goalkeeper=false){
 const indices=zone==='shirt'?[7,8,9]:zone==='pants'?(goalkeeper?[10,11]:[10,11,12]):zone==='socks'?(goalkeeper?[10,11]:[13,14]):goalkeeper?[7,8,9,10,11]:[7,8,9,10,11,12,13,14,15];
 return resource.matrix.map((row,y)=>row.map((pixel,x)=>!!resource.editable?.[y][x]&&indices.includes(pixel)));
}

export function kitDrawingResource(rom,team,table,direction=0){
 if(!Number.isInteger(direction)||direction<0||direction>7)throw new Error('Dirección de uniforme inválida.');
 const goalie=table===0x10326,index=direction+(goalie?8:0),descriptor=loRom(0x820000|word(rom,0xed1d+index*2)),transfer=word(rom,descriptor+2)|rom[descriptor+4]<<16,offset=loRom(transfer),topSize=word(rom,offset),bottom=offset+2+topSize,bottomSize=word(rom,bottom),address=o=>(0x80+(o>>15))<<16|(o&0x7fff)|0x8000;
 const pointer=teamPointer(rom,table,team),colors=palette(rom,teamPaletteOffset(rom,pointer)+2,goalie?11:16);if(goalie)colors.unshift('transparent');colors[0]='transparent';while(colors.length<16)colors.push('transparent');
 const detail=0x980000|teamPointer(rom,0xce8a,team),ranges=[[address(offset+2),topSize],[address(bottom+2),bottomSize]];if(!goalie)ranges.push([detail,32]);
 const resource=spriteResource(rom,'Dibujo del uniforme',ranges,goalie?0x988b61:0x988472,(word(rom,descriptor)-(goalie?0x4168:0x4000))/2,colors,goalie||detail===0x98f014?[0,1]:[0,1,2]);
 if(word(rom,0xed3d+index*2)&64)for(const key of ['matrix','owners','editable'])resource[key].forEach(row=>row.reverse());
 return resource;
}

// A brush stroke updates every visible use of a reused source pixel.
export function normalizeKitDrawing(resource,matrix,before=resource.matrix){
 const changes=new Map();matrix.forEach((row,y)=>row.forEach((pixel,x)=>{const o=resource.owners[y][x];if(o&&pixel!==before[y][x])changes.set(`${o.part}:${o.x}:${o.y}`,pixel);}));
 return matrix.map((row,y)=>row.map((pixel,x)=>{const o=resource.owners[y][x],key=o&&`${o.part}:${o.x}:${o.y}`;return changes.has(key)?changes.get(key):pixel;}));
}

// Native garment ramps run from their darkest entry toward their lightest.
// Quantize before interpolation so every preview color is representable on SNES.
export function kitToneColors(primary,count){
 if(!/^#[0-9a-f]{6}$/i.test(primary)||!Number.isInteger(count)||count<1||count>5)throw new Error('Color inválido.');
 const rgb=[1,3,5].map(i=>Math.round(parseInt(primary.slice(i,i+2),16)*31/255));
 return Array.from({length:count},(_,i)=>'#'+rgb.map(v=>Math.round((v+ (31-v)*(count===1?0:i/(count-1)*0.52)))*255/31).map(v=>Math.round(v).toString(16).padStart(2,'0')).join(''));
}
