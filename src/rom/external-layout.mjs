// Relocated WC26/Champions League layout. Verified against loader instructions,
// the 56-entry name directory, 10-byte names and 56 squads of 7-byte attributes.
const WC26 = Object.freeze({ id:'wc26-56', teams:56, nameLength:10, nameTable:0x38138, nameBank:0xaf, attributes:0x150000, flagTable:0xff18, flagBank:0x9a, labelTable:0xfea4, labelBank:0x9b, flagPaletteTable:0xfe06, formationTable:0xe730, largeNames:0xa7e4b6, largeNameDirectory:0x82fa65, groups:0xe7ee, groupSize:4, detailTable:0x1fa5e, paletteTables:{0x1027a:0x10274,0x102d0:0x102e6,0x10326:0x10358,0x1037c:0x1043c,0x103d2:0x103ca,0xe7d8:0xfe06} });
const matches=(rom,offset,bytes)=>bytes.every((b,i)=>rom[offset+i]===b);
export function externalDeluxeLayout(rom, verify=false) {
  if(rom?.length!==0x200000 || !matches(rom,0x4f3c,[0xbf,0x38,0x81,0x87,0x22,0xca,0xf9,0x80]) ||
     !matches(rom,0x4f48,[0x54,0x7e,0xaf]) || !matches(rom,0x4f6b,[0x54,0x7e,0xaf]))return null;
  for(let team=0;team<WC26.teams;team++) {
    const cursor=WC26.nameTable+team*2,pointer=rom[cursor]|rom[cursor+1]<<8;
    if(pointer!==0xbd20+team*200)return null;
    if(verify){
      const name=0x178000+(pointer&0x7fff);
      for(let i=0;i<200;i++){const b=rom[name+i];if(!(b===0||[0x54,0x56,0x57,0x5a,0x5c,0x5f].includes(b)||b>=0x68&&b<=0x9b))return null;}
      for(let p=0;p<20;p++){
        const offset=WC26.attributes+team*140+p*7,a=rom.subarray(offset,offset+7);
        if(a.length!==7||a.slice(0,4).some(b=>(b>>4)>9||(b&15)>9)||(a[4]>>4)<1||(a[4]>>4)>6||(a[4]&15)>9||a[5]>19||(a[6]>>4)>1||(a[6]&15)>13)return null;
      }
    }
  }
  return WC26;
}
