import {externalDeluxeLayout} from './external-layout.mjs';
import {loRom,word,decompress,tiles} from './binary.mjs';
import {graphicPatch,graphicPatches,spriteResource,titlePortraits} from './graphics.mjs';
import {wc26TeamPresentation,wc26Palette} from './wc26-data.mjs';
import {mainMenuGraphics} from './main-menu.mjs';
import {screenTextResources} from './screen-text.mjs';
import {dogRefereeSheet} from './dog-referee-graphics.mjs';
import {wc26TitleLogo} from './wc26-title.mjs';
export function wc26Graphics(rom,team){
  const p=externalDeluxeLayout(rom),presentation=wc26TeamPresentation(rom,team);
  const part=(table,bank,index,bpp)=>{
    const offset=loRom(bank<<16|word(rom,table+index*2)),data=decompress(rom,offset);
    return {id:`graphic:${offset}`,offset,capacity:word(rom,offset)&0x7fff,compressed:true,interleaved:!!(word(rom,offset)&0x8000),bpp,columns:bpp===4?3:4,decodedSize:data.length};
  };
  const flags=[0,1].map(i=>part(p.flagTable,p.flagBank,team*2+i,4)),label=part(p.labelTable,p.labelBank,team,2);
  return [{id:`wc26-flag:${team}`,label:'Bandera del equipo',kind:'wc26-flag',paletteOffset:wc26Palette(rom,team,0xe7d8,4).offset,matrix:presentation.flag,colors:presentation.colors,bpp:4,parts:flags},
    {...label,label:'Rótulo del equipo',kind:'wc26-label',matrix:tiles(decompress(rom,label.offset),2,4),colors:presentation.teamColors}];
}
function allocationPatch(original,resource,matrix){
  const baseline=tiles(resource.compressed?decompress(original,resource.offset):original.subarray(resource.offset,resource.offset+resource.capacity),resource.bpp,resource.columns);
  if(matrix.length===baseline.length&&matrix.every((row,y)=>row.length===baseline[y].length&&row.every((pixel,x)=>pixel===baseline[y][x])))return {id:resource.id,label:resource.label,offset:resource.offset,bytes:original.slice(resource.offset,resource.offset+(resource.compressed?word(original,resource.offset)&0x7fff:resource.capacity))};
  return graphicPatch(original,resource,matrix);
}
export function wc26GraphicPatches(original,resource,matrix,current=original){
  if(resource.kind==='wc26-flag'){
    if(matrix.length!==16||matrix.some(row=>row.length!==24))throw new Error('La bandera debe medir 24 × 16.');
    return resource.parts.map((part,i)=>allocationPatch(original,part,matrix.slice(i*8,i*8+8)));
  }
  if(resource.kind==='wc26-label'||!resource.kind)return [allocationPatch(original,resource,matrix)];
  return graphicPatches(original,current,resource,matrix);
}
export function wc26RestoreGraphicPatches(original,resource){
  return (resource.parts||[resource]).flatMap((part,i)=>resource.editableParts&&!resource.editableParts.includes(i)?[]:[{
    id:part.id,label:resource.label,offset:part.offset,
    bytes:original.slice(part.offset,part.offset+(part.compressed?word(original,part.offset)&0x7fff:part.capacity)),
  }]);
}
export function wc26SharedTeams(rom,resource){
  const profile=externalDeluxeLayout(rom);
  if(resource.kind==='sprite'&&resource.editableParts?.length===1){const offset=resource.parts[resource.editableParts[0]].offset;return Array.from({length:profile.teams},(_,team)=>team).filter(team=>loRom(0x980000|word(rom,profile.detailTable+team*2))===offset);}
  if(!['wc26-flag','wc26-label'].includes(resource.kind))return Array.from({length:profile.teams},(_,team)=>team);
  const ids=new Set((resource.parts||[resource]).map(p=>p.offset));
  return Array.from({length:profile.teams},(_,team)=>team).filter(team=>{
    const pointers=resource.kind==='wc26-flag'?[0,1].map(part=>loRom(profile.flagBank<<16|word(rom,profile.flagTable+team*4+part*2))):[loRom(profile.labelBank<<16|word(rom,profile.labelTable+team*2))];
    return pointers.some(offset=>ids.has(offset));
  });
}

// Resources consumed by the existing Studio; relocated allocations retain their
// own patch builder instead of using the native editor's reserved pools.
export function wc26StudioGraphics(rom,team,warnings=[]){
  const p=wc26TeamPresentation(rom,team),kit=p.kits.home.colors.slice(),goalie=['transparent',...p.kits.goalkeeper.colors];
  kit[0]='transparent';while(goalie.length<16)goalie.push('transparent');
  const profile=externalDeluxeLayout(rom),detail=0x980000|word(rom,profile.detailTable+team*2);
  const raw=(label,address,size,columns)=>{
    const offset=loRom(address);
    return {id:`graphic:${offset}`,label,offset,capacity:size,decodedSize:size,bpp:4,columns,compressed:false,shared:true,matrix:tiles(rom.slice(offset,offset+size),4,columns),colors:kit};
  };
  const optional=(resource,read)=>{try{return read();}catch(error){warnings.push({resource,reason:error.message});return [];}};
  return [...wc26Graphics(rom,team).map(r=>({...r,externalKind:r.kind,kind:r.kind==='wc26-flag'?'flag':'label',team,capacity:r.capacity||r.parts.reduce((n,p)=>n+p.capacity,0)})),
    spriteResource(rom,'Detalles de camiseta · vista frontal compartida',[[0xa9a7c6,256],[0xa9a8c8,224],[detail,32]],0x988472,112,kit,[2]),
    spriteResource(rom,'Jugador completo · sprite compartido',[[0xa9a7c6,256],[0xa9a8c8,224],[detail,32]],0x988472,112,kit,[0,1]),
    spriteResource(rom,'Portero completo · sprite compartido',[[0x90ccf2,224],[0x90cdd4,192]],0x988846,39,goalie),
    raw('Números de camisetas · atlas compartido',0x98e5d4,0xa40,2),
    raw('Balón · atlas compartido',0x9a8000,0x600,8),
    ...optional('Árbitro perro',()=>[dogRefereeSheet(rom)]),
    ...Array.from({length:13},(_,i)=>raw(`Pelo ${i+1} · atlas compartido`,0x97cd58+i*0x300,0x300,24)),
    ...optional('Logo completo de portada',()=>[wc26TitleLogo(rom)]),
    ...optional('Fondo de portada',()=>[wc26TitleLogo(rom,true)]),
    ...optional('Fotos de portada',()=>titlePortraits(rom)),
    ...optional('Gráficos del menú principal',()=>mainMenuGraphics(rom)),
    ...optional('Títulos de modo y contraseña',()=>screenTextResources(rom))];
}
