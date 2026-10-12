import {externalDeluxeLayout} from './external-layout.mjs';
import {loRom,word,decompress,tiles,palette} from './binary.mjs';

// DATA_829975 uploads the base BG atlas at VRAM $2000. WC26 adds a
// second upload at $26F0 (tile 111), overwriting the base atlas's tail.
// DATA_829987 loads the title's OAM atlas at $6000; $7300 is copyright.
// Keep the maps, upload destinations, OAM layout and palettes untouched.
export function wc26TitleLogo(rom,backgroundOnly=false){
  if(!externalDeluxeLayout(rom))throw new Error('Perfil WC26 no compatible.');
  const pointer=address=>word(rom,loRom(address))|rom[loRom(address)+2]<<16;
  const upload=(address,destination)=>{
    if(word(rom,loRom(address)-2)!==destination)throw new Error('Cargador de portada WC26 no compatible.');
    const offset=loRom(pointer(address)),data=decompress(rom,offset);
    if(!data.length||data.length%32)throw new Error('Atlas de portada WC26 no compatible.');
    return {id:`graphic:${offset}`,offset,capacity:word(rom,offset)&0x7fff,decodedSize:data.length,bpp:4,columns:1,compressed:true,interleaved:!!(word(rom,offset)&0x8000)};
  };
  const parts=[upload(0x829979,0x2000),upload(0x829995,0x26f0),upload(0x82998b,0x6000)];
  const strips=parts.map(p=>tiles(decompress(rom,p.offset),4,1));
  const colors=[...palette(rom,loRom(0x89c292),16),...palette(rom,loRom(0x89c2b4),16),...palette(rom,loRom(0x89c318),16)];
  colors[0]=colors[16]=colors[32]='transparent';
  const matrix=Array.from({length:128},()=>Array(256).fill(1));
  const owners=matrix.map(row=>row.map(()=>null)),layers=matrix.map(row=>row.map(()=>[]));
  for(const address of backgroundOnly?[0x829983]:[0x829983,0x82997e]){
    if(word(rom,loRom(address)-2)!==(address===0x829983?0x1000:0))throw new Error('Cargador de mapas WC26 no compatible.');
    const map=decompress(rom,loRom(pointer(address)));
    if(map.length!==2048)throw new Error('Mapa de portada WC26 no compatible.');
    for(let y=0;y<128;y++)for(let x=0;x<256;x++){
      const entry=word(map,((y>>3)*32+(x>>3))*2),tile=entry&1023;
      const part=tile>=111&&tile<111+parts[1].decodedSize/32?1:0,t=part===1?tile-111:tile;
      const sx=entry&0x4000?7-x%8:x%8,sy=t*8+(entry&0x8000?7-y%8:y%8),paletteBase=((entry>>10)&7)*16;
      const pixel=strips[part][sy]?.[sx];
      if(pixel===undefined||paletteBase>16)throw new Error('Tiles o paletas de portada WC26 no compatibles.');
      // Base tiles 0/110 are transparent and 1 is the shared white backdrop.
      const editable=part!==0||![0,1,110].includes(tile);
      const owner={part,x:sx,y:sy,paletteBase};
      if(editable)layers[y][x].push(owner);
      if(pixel){matrix[y][x]=paletteBase+pixel;owners[y][x]=editable?owner:null;}
      else if(editable&&!owners[y][x])owners[y][x]=owner;
    }
  }
  const object=loRom(0x81f5ff),oam=loRom(0x880000|word(rom,object));
  const signed=v=>v>127?v-256:v,cx=word(rom,object+2),cy=word(rom,object+4);
  if(rom[oam]!==31||cx!==96||cy!==64)throw new Error('Sprites de portada WC26 no compatibles.');
  for(let i=backgroundOnly?-1:rom[oam]-1;i>=0;i--){
    const [y,x,tile,attr]=rom.subarray(oam+1+i*4,oam+5+i*4),size=attr&16?16:8;
    // Direct object coordinates are sprite centers, like the main-menu OAM.
    const left=cx+signed(x)-size/2,top=cy+signed(y)-size/2;
    if((attr&15)!==12)throw new Error('Paleta de sprites de portada WC26 no compatible.');
    for(let j=0;j<size;j++)for(let k=0;k<size;k++){
      const fx=attr&64?size-1-k:k,fy=attr&128?size-1-j:j,sx=fx%8,sy=(tile+(fx>>3)+(fy>>3)*16)*8+fy%8;
      const pixel=strips[2][sy]?.[sx],px=left+k,py=top+j;
      if(pixel===undefined||!layers[py]?.[px])throw new Error('Composición de portada WC26 no compatible.');
      const owner={part:2,x:sx,y:sy,paletteBase:32};layers[py][px].push(owner);
      if(pixel||!owners[py][px]){if(pixel)matrix[py][px]=32+pixel;owners[py][px]=owner;}
    }
  }
  return {id:backgroundOnly?'title-background':'title-logo',kind:'composite',label:backgroundOnly?'Fondo de portada':'Logo completo de portada',
    shared:true,bpp:8,columns:32,capacity:parts.reduce((n,p)=>n+p.capacity,0),parts,layers,owners,matrix,colors,
    editableParts:backgroundOnly?[0]:[0,1,2],editable:owners.map(row=>row.map(Boolean)),
    importEditable:owners.map((row,y)=>row.map((o,x)=>!!o&&matrix[y][x]!==1))};
}
