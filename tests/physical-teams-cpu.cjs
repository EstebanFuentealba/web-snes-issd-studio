const assert=require('assert/strict'),fs=require('fs');
global.crypto ||= require('crypto').webcrypto;
(async()=>{
 const {RomProject}=await import('../src/rom/project.mjs');
 const {loRom,word,decompress}=await import('../src/rom/binary.mjs');
 const {teamExists,activeTeamIds,attributeOffset,teamPointer,IDENTITY_MAP}=await import('../src/rom/team-count.mjs');
 const {deluxePlayerNameOffset}=await import('../src/rom/deluxe.mjs');
 const file='roms/International Superstar Soccer Deluxe (USA).sfc';if(!fs.existsSync(file)){console.log('SKIP physical teams CPU: local USA ROM unavailable');return;}
 const p=await RomProject.create(new Uint8Array(fs.readFileSync(file)));for(const name of ['CHILE','PERU','BOLIVIA'])p.addTeam(name);p.deleteTeam(0);p.deleteTeam(36);p.deleteTeam(43);
 function cpu(rom){
  const ram=new Uint8Array(0x20000),stack=[],returns=[];let a=0,x=0,y=0,pc=0,carry=0,bank=0;
  const read8=addr=>addr>>>16===0x7e||addr<0x10000?ram[addr&0xffff]:rom[loRom(addr)];
  const write=(addr,v)=>{ram[addr&0xffff]=v&255;ram[(addr+1)&0xffff]=v>>>8;};
  const read=addr=>read8(addr)|read8(addr+1)<<8;
  const byte=()=>read8(pc++),nextWord=()=>byte()|byte()<<8,long=()=>nextWord()|byte()<<16;
  const branch=take=>{const n=byte();if(take)pc+=n<128?n:n-256;};
  function run(start,stop){pc=start;for(let steps=0;steps<1000;steps++){
   if(pc===stop)return;const at=pc,op=byte();switch(op){
    case 0xc9:carry=a>=nextWord()?1:0;break;case 0x90:branch(!carry);break;case 0xb0:branch(carry);break;case 0x80:branch(true);break;
    case 0x18:carry=0;break;case 0x38:carry=1;break;
    case 0x69:{const n=a+nextWord()+carry;a=n&65535;carry=n>65535?1:0;break;}
    case 0xe9:{const n=a-nextWord()-(1-carry);a=n&65535;carry=n>=0?1:0;break;}
    case 0x22:{const target=long();returns.push(pc);pc=target;break;}
    case 0x5c:pc=long();break;
    case 0x6b:if(returns.length)pc=returns.pop();else{assert.equal(stack.length,0);return;}break;
    case 0x85:write(byte(),a);break;case 0x84:write(byte(),y);break;case 0x8d:write(nextWord(),a);break;
    case 0xad:a=read(nextWord());break;case 0xa9:a=nextWord();break;case 0xaa:x=a;break;case 0xbf:a=read(long()+x);break;
    case 0x8b:stack.push(bank);break;case 0xab:bank=stack.pop();break;
    case 0x54:{const dest=byte(),source=byte(),n=a+1;for(let i=0;i<n;i++)ram[(y+i)&65535]=read8(source<<16|(x+i)&65535);x=(x+n)&65535;y=(y+n)&65535;a=65535;bank=dest;break;}
    case 0xda:stack.push(x);break;case 0xfa:x=stack.pop();break;case 0x48:stack.push(a);break;case 0x68:a=stack.pop();break;case 0xa2:x=nextWord();break;case 0xe8:x=(x+1)&65535;break;case 0x65:{const n=a+read(byte())+carry;a=n&65535;carry=n>65535?1:0;break;}
    case 0xea:break;default:throw Error(`Unexpected opcode ${op.toString(16)} at ${at.toString(16)}`);
   }
  }throw Error('Routine did not terminate');}
  return {ram,read,run,get a(){return a;},set a(v){a=v;},get x(){return x;},set x(v){x=v;},get y(){return y;},set y(v){y=v;},get bank(){return bank;}};
 }
 function verify(rom){
  const hook=a=>rom[loRom(a)+1]|rom[loRom(a)+2]<<8|rom[loRom(a)+3]<<16,fallback=activeTeamIds(rom)[0];
  for(let t=0;t<49;t++){
   const mapped=t===48?48:teamExists(rom,t)?t:fallback;
   const expected=t===48?0x96f8:attributeOffset(rom,mapped)-0x50000+0x8000;
   const c=cpu(rom);c.x=0x1234;c.a=(t+1)*140;c.run(hook(0x83c6bd));assert.equal(c.read(0),expected);assert.equal(c.x,0x1234);
   for(let player=0;player<20;player++){const d=cpu(rom);d.x=0x5678;d.a=0x8000+t*140+player*7;d.run(hook(0x98f82a));assert.equal(d.read(0x0d38),expected+player*7);assert.equal(d.x,0x5678);assert.equal(d.a,0x8a);}
   if(t<48)for(const dest of [0xd478,0xd518]){const n=cpu(rom);n.a=t*2;n.y=dest;n.run(hook(0xa49c89));const bytes=Uint8Array.from({length:160},(_,i)=>rom[deluxePlayerNameOffset(rom,mapped,Math.floor(i/8))+i%8]);assert.deepEqual(n.ram.slice(dest,dest+160),bytes);assert.equal(n.bank,0);}
  }
  // Execute only DMA descriptors for live squads and decompress their actual
  // ROM source bytes. Deleted slots must never appear in either script.
  for(const [address,parts,size] of [[0x82fb5d,2,96],[0x82fda1,1,64]]){
   const start=loRom(address),ids=activeTeamIds(rom);assert.equal(word(rom,start),1);assert.equal(word(rom,start+2+ids.length*parts*6),65535);
   ids.forEach((t,i)=>{for(let part=0;part<parts;part++){const off=start+2+(i*parts+part)*6,source=word(rom,off+3)|rom[off+5]<<16;assert.equal(decompress(rom,loRom(source)).length,size);assert.equal(source,parts===2?0xb0ca40+(t*2+part)*102:0xafdf00+t*69);}});
  }
 }
 verify(p.bytes());p.addTeam('CHILE');verify(p.bytes());const reopened=await RomProject.create(p.exportRom());verify(reopened.bytes());
 console.log('PASS physical teams CPU: 49 match routes, 980 preview players, native/All-Star/extra name copying, live-only DMA, deleted-ID redirects, reuse and exported ROM');
})().catch(e=>{console.error(e);process.exitCode=1;});
