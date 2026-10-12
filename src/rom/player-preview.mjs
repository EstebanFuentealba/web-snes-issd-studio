import {decompress,loRom,word,tiles} from './binary.mjs';
import {teamPointer} from './team-count.mjs';
import {deluxeAppearance} from './appearance.mjs';

// NUMBER/PRESET/EDIT uses these eight DMA descriptors and flips in
// DATA_81ED1D / DATA_81ED3D, including its dedicated goalkeeper poses.
export function playerPreviewFrames(rom,team,player) {
  const colors=deluxeAppearance(rom,team,player).headColors;
  const goalie=player.position===1;
  const oam=decompress(rom,loRom(goalie?0x988b61:0x988472)),count=word(oam,1),base=3+oam[0];
  return Array.from({length:8},(_,direction)=>{
    const tableIndex=direction+(player.position===1?8:0);
    const descriptor=loRom(0x820000|word(rom,0xed1d+tableIndex*2));
    const start=(word(rom,descriptor)-(goalie?0x4168:0x4000))/2;
    const transfer=loRom(word(rom,descriptor+2)|(rom[descriptor+4]<<16));
    const topSize=word(rom,transfer),bottom=transfer+2+topSize,bottomSize=word(rom,bottom);
    const strips=[tiles(rom.slice(transfer+2,bottom),4,topSize/32),tiles(rom.slice(bottom+2,bottom+2+bottomSize),4,bottomSize/32)];
    const detail=loRom(0x980000|teamPointer(rom,0xce8a,team));
    strips.push(tiles(rom.slice(detail,detail+32),4,1));
    let sum=0,frame=0;while(sum<start&&frame<oam[0])sum+=oam[3+frame++];
    if(sum!==start)throw new Error('Composición OAM no compatible.');
    const matrix=Array.from({length:56},()=>Array(48).fill(0));
    for(let i=oam[3+frame]-1;i>=0;i--){
      const values=[0,1,2,3].map(p=>oam[base+count*p+start+i]);
      const size=values[3]&16?16:8,adjust=size===16?4:0;
      const left=(values[0]>127?values[0]-256:values[0])-adjust+24;
      const top=(values[1]>127?values[1]-256:values[1])-adjust+40;
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){
        const fx=values[3]&64?size-1-x:x,fy=values[3]&128?size-1-y:y;
        const tile=values[2]+Math.floor(fx/8)+Math.floor(fy/8)*16;
        const part=player.position!==1&&tile===23?2:tile>=16?1:0;
        const pixel=strips[part]?.[fy%8]?.[(part===2?0:tile%16)*8+fx%8]||0;
        if(pixel&&matrix[top+y]?.[left+x]!==undefined)matrix[top+y][left+x]=pixel;
      }
    }
    // CODE_98FB86 overlays a single 8px head using DATA_9890CC,
    // one pixel right and one pixel above the body's OAM origin.
    if(!goalie&&player.hair>=1&&player.hair<=13){
      const hairPointer=0xed6d+(player.hair-1)*4;
      const hairBase=loRom(word(rom,hairPointer)|(rom[hairPointer+2]<<16));
      const head=tiles(rom.slice(hairBase+(rom[descriptor+8]-1)*32,hairBase+rom[descriptor+8]*32),4,1);
      const heads=decompress(rom,loRom(0x9890cc)),headCount=word(heads,1),headBase=3+heads[0];
      const headIndex=(word(rom,descriptor+6)-0x412c)/2;
      const signed=v=>v>127?v-256:v;
      const hx=signed(heads[headBase+headIndex])+25,hy=signed(heads[headBase+headCount+headIndex])+39;
      const attr=heads[headBase+headCount*3+headIndex];
      for(let y=0;y<8;y++)for(let x=0;x<8;x++){
        const pixel=head[attr&128?7-y:y][attr&64?7-x:x];
        if(pixel&&matrix[hy+y]?.[hx+x]!==undefined)matrix[hy+y][hx+x]=pixel;
      }
    }
    if(word(rom,0xed3d+tableIndex*2)&64)matrix.forEach(row=>row.reverse());
    return {matrix,colors};
  });
}
