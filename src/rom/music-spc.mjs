import {decompress,word,loRom} from './binary.mjs';
import {decodeMusic,musicDriver,MUSIC_BASE} from './music.mjs';
const signature='SNES-SPC700 Sound File Data v0.30';
const ascii=s=>Uint8Array.from(s,c=>c.charCodeAt(0));
// Standalone boot: initialize the native engine, then start the loaded song.
// This bootstrap is confined to the exported SPC; ROM code is never patched.
export function writeSpc(rom,resource,sequence){
 const song=decodeMusic(sequence);if(song.tracks.length!==resource.channels)throw new Error('El número de canales no coincide con el evento musical nativo.');const driver=musicDriver(rom),out=new Uint8Array(0x10220),ram=out.subarray(0x100,0x10100);
 out.set(ascii(signature));out.set([26,26,26,30],33);out[37]=0;out[38]=2;out[43]=255;out[0x10100+0x6c]=0x20; // Disable echo writes until native initialization.
 out.set(ascii(resource.name.slice(0,31)),46);out.set(ascii('International Superstar Soccer Deluxe'.slice(0,32)),78);
 ram.set(driver,0x200);const sampleOffset=loRom(0xbfc0b6),size=word(rom,sampleOffset);if(size>0x3d6f)throw new Error('Banco de instrumentos no compatible.');ram.set(rom.subarray(sampleOffset+2,sampleOffset+size),0x6900);
 // The game selects one of four streamed instrument banks per song.
 let index=-1;for(let i=0;i<20;i++){const o=loRom(0x829d23)+i*4,a=rom[o+1]|rom[o+2]<<8|rom[o+3]<<16;if(loRom(a)===resource.offset)index=i;}
 if(index<0)throw new Error('Canción SPC no compatible.');const bankId=word(rom,loRom(0x829d73)+index*2)/3;
 if(bankId){const o=loRom(0x829d17)+(bankId-1)*3,a=rom[o]|rom[o+1]<<8|rom[o+2]<<16,start=loRom(a|0x800000);const bank=rom.subarray(start+2,start+word(rom,start));if(bank.length>0x5995)throw new Error('Banco de instrumentos no compatible.');ram.set(bank,0xa66b);}
 ram.set(sequence,MUSIC_BASE);
 // Redirect initialization to the isolated song-start bootstrap.
 ram.set([0x5f,0x18,0x37],0x272);
 ram.set([0xe8,0x50+index,0x3f,0x59,0x0c,0x5f,0x34,0x0e],0x3718);
 // Store bounded editor metadata outside ARAM. It identifies the exact block,
 // but imports still validate driver, track count and all sequence pointers.
 out.set(ascii('ISSMUS1'),0x10200);out[0x10208]=sequence.length&255;out[0x10209]=sequence.length>>>8;out[0x1020a]=song.tracks.length;out[0x1020b]=index;
 return out;
}
export function readSpc(input,rom,resource){
 const bytes=new Uint8Array(input);if(bytes.length<0x10200||bytes.length>2000000||!ascii(signature).every((v,i)=>v===bytes[i])||bytes[33]!==26||bytes[34]!==26)throw new Error('Archivo SPC inválido.');
 const ram=bytes.subarray(0x100,0x10100),driver=musicDriver(rom);
 // Accept native captures and our isolated boot image, without importing CPU,
 // DSP, sample data or executable code into the ROM.
 for(const [start,end] of [[0xa07,0xa2f],[0x13ff,0x145f],[0x15f7,0x1677]])for(let a=start;a<end;a++)if(ram[a]!==driver[a-0x200])throw new Error('El SPC usa otro driver musical.');
 const native=decodeMusic(decompress(rom,resource.offset)),channels=native.tracks.length;
 let size=0x2000;
 if(ascii('ISSMUS1').every((v,i)=>v===bytes[0x10200+i]))size=bytes[0x10208]|bytes[0x10209]<<8;
 if(size<3||size>0x2000)throw new Error('Secuencia SPC inválida.');
 const sequence=ram.slice(MUSIC_BASE,MUSIC_BASE+size);const song=decodeMusic(sequence);if(song.tracks.length!==channels)throw new Error('El SPC supera los canales disponibles de esta canción.');return sequence;
}
