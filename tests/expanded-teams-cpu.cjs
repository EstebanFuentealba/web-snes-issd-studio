const assert=require('node:assert/strict'),fs=require('node:fs');
global.crypto ||= require('node:crypto').webcrypto;
// Execute the generated 16-bit 65816 routines with byte-accurate data stacks,
// DB-sensitive reads and the C0–FF low-half mirrors of a 4 MiB LoROM.
function cpu(rom){
 const ram=new Uint8Array(0x20000),stack=[],returns=[];let a=0,x=0,y=0,pc=0,carry=0,zero=false,db=0,m8=false;
 const read8=address=>{const bank=address>>>16,off=address&65535;if(bank===0x7e||bank===0x7f)return ram[((bank-0x7e)<<16)|off];if(off<0x2000&&(bank&0x7f)<0x40)return ram[off];if(off>=0x8000||bank>=0xc0)return rom[(bank&127)*32768+(off&32767)];throw Error(`Unmapped read ${address.toString(16)}`);};
 const read=addr=>read8(addr)|read8((addr&0xff0000)|((addr+1)&65535))<<8;
 const write8=(address,value)=>{const bank=address>>>16,off=address&65535;assert.ok(bank===0x7e||bank===0x7f||off<0x2000&&((bank&127)<0x40));ram[bank===0x7f?65536+off:off]=value&255;};
 const write=(addr,value)=>{write8(addr,value);write8(addr+1,value>>>8);};
 const push=v=>stack.push(v&255),pull=()=>{assert.ok(stack.length,'Stack underflow');return stack.pop();},push16=v=>{push(v>>>8);push(v);},pull16=()=>pull()|pull()<<8;
 const byte=()=>read8(pc++),word=()=>byte()|byte()<<8,long=()=>word()|byte()<<16,nz=v=>{zero=(v&65535)===0;return v&65535;},branch=take=>{const n=byte();if(take)pc+=n<128?n:n-256;};
 const acc=v=>{const result=v&(m8?255:65535);zero=result===0;a=m8?(a&0xff00)|result:result;return a;};
 const adc=n=>{const sum=a+n+carry;carry=sum>65535?1:0;a=nz(sum);};
 function run(start,stop){pc=start;for(let n=0;n<10000;n++){if(pc===stop)return;const at=pc,op=byte();switch(op){
  case 0xc9:{const v=m8?byte():word(),value=a&(m8?255:65535);carry=value>=v?1:0;zero=value===v;break;}case 0xc0:{const v=word();carry=y>=v?1:0;zero=y===v;break;}case 0x90:branch(!carry);break;case 0xb0:branch(carry);break;case 0xf0:branch(zero);break;case 0xd0:branch(!zero);break;case 0x80:branch(true);break;
  case 0x18:carry=0;break;case 0x38:carry=1;break;case 0x69:adc(word());break;case 0x65:adc(read(byte()));break;
  case 0xe9:{const v=a-word()-(1-carry);carry=v>=0?1:0;a=nz(v);break;}case 0x29:acc(a&(m8?byte():word()));break;
  case 0x0a:carry=a>>>15;a=nz(a<<1);break;case 0x4a:carry=a&1;a=nz(a>>>1);break;
  case 0x22:{const target=long();returns.push(pc);pc=target;break;}case 0x5c:pc=long();break;case 0x4c:pc=(pc&0xff0000)|word();break;
  case 0x6b:case 0x60:if(returns.length)pc=returns.pop();else{assert.equal(stack.length,0);return;}break;
  case 0xa9:a=nz(word());break;case 0xa2:x=nz(word());break;case 0xa0:y=nz(word());break;
  case 0xa5:a=nz(read(byte()));break;case 0xa6:x=nz(read(byte()));break;case 0xad:a=nz(read(db<<16|word()));break;
  case 0xbd:{const addr=db<<16|((word()+x)&65535);acc(m8?read8(addr):read(addr));break;}case 0xbc:y=nz(read(db<<16|((word()+x)&65535)));break;case 0xb7:{const dp=byte(),addr=(read(dp)|read8(dp+2)<<16)+y;acc(m8?read8(addr):read(addr));break;}case 0xb9:a=nz(read(db<<16|((word()+y)&65535)));break;case 0xbf:a=nz(read(long()+x));break;
  case 0x85:{const addr=byte();if(m8)write8(addr,a);else write(addr,a);break;}case 0x04:{const addr=byte(),v=m8?read8(addr):read(addr);zero=!(v&(a&(m8?255:65535)));if(m8)write8(addr,v|a);else write(addr,v|a);break;}case 0x84:write(byte(),y);break;case 0x86:write(byte(),x);break;case 0x8d:write(db<<16|word(),a);break;
  case 0x99:write(db<<16|((word()+y)&65535),a);break;case 0x9f:write(long()+x,a);break;
  case 0xaa:x=nz(a);break;case 0x8a:a=nz(x);break;case 0x98:a=nz(y);break;case 0xa8:y=nz(a);break;case 0xbb:x=nz(y);break;
  case 0x88:y=nz(y-1);break;case 0xe8:x=nz(x+1);break;case 0xc8:y=nz(y+1);break;case 0xc6:{const p=byte(),v=nz(read(p)-1);write(p,v);break;}
  case 0xda:push16(x);break;case 0xfa:x=nz(pull16());break;case 0x5a:push16(y);break;case 0x7a:y=nz(pull16());break;case 0x48:push16(a);break;case 0x68:a=nz(pull16());break;
  case 0x8b:push(db);break;case 0xab:db=pull();zero=db===0;break;case 0xf4:push16(word());break;case 0x28:{const f=pull();assert.equal(f&0x30,0,'16-bit A/X/Y expected');carry=f&1;zero=!!(f&2);break;}
  case 0x54:{const dest=byte(),source=byte(),len=a+1;for(let i=0;i<len;i++)write8(dest<<16|((y+i)&65535),read8(source<<16|((x+i)&65535)));x=(x+len)&65535;y=(y+len)&65535;a=65535;db=dest;break;}
  case 0xea:break;default:throw Error(`Opcode ${op.toString(16)} at ${at.toString(16)}`);
 }}throw Error('Routine did not terminate');}
 return {ram,read,write,run,get accumulator8(){return m8;},set accumulator8(v){m8=!!v;},get a(){return a;},set a(v){a=v;},get x(){return x;},set x(v){x=v;},get y(){return y;},set y(v){y=v;},get db(){return db;},set db(v){db=v;}};
}
module.exports={cpu};
if(require.main===module)(async()=>{
 const {RomProject}=await import('../src/rom/project.mjs'),{playerPatches}=await import('../src/rom/players.mjs'),{loRom,word,decompress}=await import('../src/rom/binary.mjs'),{attributeOffset,teamPointer,teamPaletteOffset}=await import('../src/rom/team-count.mjs'),{deluxePlayerNameOffset}=await import('../src/rom/deluxe.mjs'),{EXPANDED,expandedFlagBuffer,expandedLabelBuffer}=await import('../src/rom/expanded-layout.mjs');
 const file='roms/International Superstar Soccer Deluxe (USA).sfc';if(!fs.existsSync(file)){console.log('SKIP expanded CPU: local USA ROM unavailable');return;}
 const p=await RomProject.create(new Uint8Array(fs.readFileSync(file)));p.transaction(playerPatches(p.bytes(),0,0,{name:'ABCDEFGHIJ'}));for(let i=42;i<56;i++)p.addTeam('TEAM');const rom=p.exportRom(),hook=a=>word(rom,loRom(a)+1)|rom[loRom(a)+3]<<16;
 // Header decoding must keep C5/C6/C8 banks only for the expanded pools.
 // Native bank-$40 script flags still need their original masking behavior.
 const cases=[[0xc5,0x8000,true],[0xc5,0xaca0,false],[0xc6,0x8000,true],[0xc6,0x8f18,false],[0xc8,0x9000,true],[0xc8,0x8000,false],[0xc8,0xa000,false],[0x89,0x83be,false],[0xc9,0x83be,false]];
 for(const [bank,source,expanded] of cases){const c=cpu(rom);c.accumulator8=true;c.db=0x82;c.x=0x200;c.a=0xab00;c.write(0x200,source);c.ram[0x202]=bank;c.run(hook(0x80b76f));const decoded=expanded?bank:bank&0xbf;assert.equal(c.ram[0x0c],decoded);assert.equal(c.y,source);assert.equal(c.x,0x200);assert.equal(c.a&0xff00,0xab00);assert.equal(c.ram[5],(rom[loRom(decoded<<16|source)+1]&0x80)|(expanded?0:bank&0x40));}
 for(let t=0;t<=56;t++){
  const c=cpu(rom);c.a=(t+1)*140;c.x=0x1234;c.run(hook(0x83c6bd));assert.equal(c.read(0),0x8000+t*140);assert.equal(c.x,0x1234);
  for(let i=0;i<20;i++){const c=cpu(rom);c.a=0x8000+t*140+i*7;c.x=0x5678;c.run(hook(0x98f82a));assert.equal(c.read(0xd38),0x8000+t*140+i*7);assert.equal(c.a,0xc2);assert.equal(c.x,0x5678);}
  for(const dest of [0xd478,0xd540]){const c=cpu(rom);c.a=t*2;c.y=dest;c.x=0x4321;c.db=0x81;c.run(hook(0xa49c89));assert.deepEqual(c.ram.slice(dest,dest+200),rom.slice(loRom(EXPANDED.names)+t*200,loRom(EXPANDED.names)+(t+1)*200));assert.equal(c.db,0x81);assert.equal(c.x,0x4321);}
 }
 const both=cpu(rom);both.write(0xda0,54*2);both.write(0xea0,55*2);both.run(0x80cf2a);for(const [t,dest] of [[54,0xd478],[55,0xd540]])assert.deepEqual(both.ram.slice(dest,dest+200),rom.slice(deluxePlayerNameOffset(rom,t,0),deluxePlayerNameOffset(rom,t,0)+200));
 for(let t=0;t<56;t++){
  const c=cpu(rom);c.a=t*2;c.run(hook(0x85af50));assert.equal(c.a,expandedLabelBuffer(t));const h=cpu(rom);h.a=t*2;h.run(hook(0x85a8e3));assert.equal(h.a,expandedLabelBuffer(t));
  for(const [table,n] of [[0x1027a,16],[0x102d0,16],[0x10326,11],[0x103d2,1],[0xe7d8,4]]){const ptr=teamPointer(rom,table,t);if(!ptr)continue;const c=cpu(rom);c.db=0x81;c.a=0x14;c.y=ptr;c.x=0x2222;c.run(0x8bd0ef);const dest=word(rom,loRom(0x819176)+0x14);assert.deepEqual(c.ram.slice(dest,dest+n*2),rom.slice(teamPaletteOffset(rom,ptr)+2,teamPaletteOffset(rom,ptr)+2+n*2));assert.equal(c.x,0x2222);assert.equal(c.y,ptr);assert.equal(c.db,0x81);}
 }
 // The dispatch also leaves every original/global $89 palette usable.
 for(const ptr of [0x83be,0xf9fe,0xfa20]){const c=cpu(rom);c.db=0x81;c.a=0x14;c.y=ptr;c.run(0x8bd0ef);const n=word(rom,loRom(0x890000|ptr))+1,dest=word(rom,loRom(0x819176)+0x14);assert.deepEqual(c.ram.slice(dest,dest+n),rom.slice(loRom(0x890000|ptr)+2,loRom(0x890000|ptr)+2+n));}
 for(let i=0;i<20;i++){const c=cpu(rom);c.a=i*2;c.write(0x16,0xd540);c.run(hook(0x80cbaf));assert.equal(c.a,0xd540+i*10);assert.equal(c.x,0xd540+i*10);const d=cpu(rom);d.a=i;d.run(hook(0x859c6e));assert.equal(d.read(0),i*10);}
 // Real opcode execution emits all ten HUD/roster tiles, including the tail.
 const c=cpu(rom);c.y=0x1f58;c.write(0x4a,0x1000);for(let i=0;i<10;i++)c.write(0x1f58+i*2,0x2000+i);c.run(hook(0x80cbe0));assert.deepEqual(Array.from({length:10},(_,i)=>c.read(0x1000+i*2)),Array.from({length:10},(_,i)=>0x2000+i));
 const ranges=[];for(const [address,count,parts,size,buffer] of [[EXPANDED.flagScript,112,2,96,expandedFlagBuffer],[EXPANDED.labelScript,56,1,64,expandedLabelBuffer]])for(let i=0;i<count;i++){const o=loRom(address)+2+i*6,dest=word(rom,o),source=word(rom,o+3)|rom[o+5]<<16;assert.equal(decompress(rom,loRom(source)).length,size);assert.equal(dest,buffer(Math.floor(i/parts))+(i%parts)*size);assert.ok(!ranges.some(([a,b])=>a<dest+size&&dest<b));ranges.push([dest,dest+size]);}
 console.log('PASS expanded CPU: 56 squads + Challenge, 1140 preview routes, 200-byte name copies, C1 low-half palette DMA and native palette fallback, 10-character strides and HUD tiles, disjoint 168 selection DMA descriptors and 8-bit decompression bank dispatch');
})().catch(e=>{console.error(e);process.exitCode=1;});
