const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
global.crypto ||= require('node:crypto').webcrypto;
(async()=>{
 const core=process.env.SNES9X_CORE,source=path.join(__dirname,'../roms/International Superstar Soccer Deluxe (USA).sfc');
 if(!core||!fs.existsSync(source)){console.log('SKIP expanded runtime: set SNES9X_CORE to a Snes9x libretro library and provide the local USA ROM');return;}
 assert.ok(fs.existsSync(core),'SNES9X_CORE library is missing');
 const {RomProject}=await import('../src/rom/project.mjs'),{playerPatches}=await import('../src/rom/players.mjs'),{loRom,decompress,word}=await import('../src/rom/binary.mjs'),{EXPANDED,expandedFlagBuffer,expandedLabelBuffer}=await import('../src/rom/expanded-layout.mjs'),{labelLayout,renameTeamPatches}=await import('../src/rom/team-labels.mjs');
 const original=new Uint8Array(fs.readFileSync(source)),p=await RomProject.create(original);
 for(let i=42;i<56;i++)p.addTeam('TEAM');
 p.transaction(renameTeamPatches(original,p.bytes(),54,'I. MILAN'));
 p.transaction(Array.from({length:20},(_,player)=>playerPatches(p.bytes(),55,player,{name:'ABCDEFGHIJ'})).flat());
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'issd-runtime-')),expanded=path.join(directory,'expanded.sfc');fs.writeFileSync(expanded,p.exportRom());
 const start=[[400,20,3],[600,20,3],[800,20,3]],selector=[...start,[1100,20,8],[1300,20,8],[1500,20,8]],last=[...selector,[2100,10,11],[2300,10,11],[2500,10,11],[2700,10,11],[2900,10,7]];
 function run(file,name,frames,events){
  const output=path.join(directory,name),result=spawnSync(process.env.PYTHON||'python3',[path.join(__dirname,'snes9x-headless.py'),path.resolve(core),file,output],{encoding:'utf8',timeout:60000,env:{...process.env,ISSD_FRAMES:String(frames),ISSD_INPUT:JSON.stringify(events)}});
  assert.equal(result.status,0,`${name}: ${result.stderr}`);const meta=JSON.parse(result.stdout.split('\n').find(line=>line.startsWith('{')));assert.equal(meta.width,256);assert.equal(meta.height,224);
  return {ram:new Uint8Array(fs.readFileSync(output+'.ram')),vram:new Uint8Array(fs.readFileSync(output+'.vram')),image:fs.readFileSync(output+'.ppm').subarray(Buffer.byteLength('P6\n256 224\n255\n')),output};
 }
 const stockMenu=run(source,'stock-menu',1000,start),menu=run(expanded,'expanded-menu',1000,start);
 // A cursor animation may have a different phase after the longer preload.
 // The actual background tilemap, menu OAM and every other pixel must match.
 for(const [a,b] of [[0x1d000,0x1d800],[0x4000,0x4500]])assert.deepEqual(menu.ram.slice(a,b),stockMenu.ram.slice(a,b));
 for(let y=0;y<224;y++)for(let x=0;x<256;x++)if(x>=128||y>=70){const i=(y*256+x)*3;assert.deepEqual(menu.image.subarray(i,i+3),stockMenu.image.subarray(i,i+3),`Menu pixel ${x},${y}`);}
 const stockSelector=run(source,'stock-selector',2000,selector),selected=run(expanded,'expanded-selector',2000,selector);
 assert.deepEqual(selected.ram.slice(0xd800,0xddfe),stockSelector.ram.slice(0xd800,0xddfe),'Native selector palettes must remain intact');
 const tail=run(expanded,'team-55',3200,last),rom=p.bytes();assert.equal(tail.ram[0xda0]|tail.ram[0xda1]<<8,110,'The last squad must be selectable');
 for(let t=0;t<56;t++){
  const flags=new Uint8Array(192);for(let part=0;part<2;part++)flags.set(decompress(rom,loRom(EXPANDED.flags)+(t*2+part)*102),part*96);
  assert.deepEqual(tail.ram.slice(0x10000+expandedFlagBuffer(t),0x10000+expandedFlagBuffer(t)+192),flags,`Cached flag ${t}`);
  assert.deepEqual(tail.ram.slice(0x10000+expandedLabelBuffer(t),0x10000+expandedLabelBuffer(t)+64),decompress(rom,loRom(EXPANDED.labels)+t*69),`Cached label ${t}`);
 }
 const layout=labelLayout(rom);for(let plane=0;plane<3;plane++)for(let i=0;i<layout.sprites;i++){
  const o=0x4f02+(plane+1)*0x2000+i*2,p=layout.base+i,expected=plane<2?((layout.data[p+plane*layout.sprites]<<24)>>24)&65535:layout.data[p+2*layout.sprites]|(layout.data[p+3*layout.sprites]&239)<<8;
  assert.equal(tail.ram[o]|tail.ram[o+1]<<8,expected,`Name OAM ${plane}:${i}`);
 }
 const handicap=run(expanded,'handicap-54',4200,[...last.filter(e=>e[0]!==2900),[3300,10,8],[3500,10,8],[3800,10,8]]);
 assert.equal(handicap.ram[0xda0]|handicap.ram[0xda1]<<8,108);
 for(const [team,index] of [[54,0],[2,1]]){const dest=word(rom,loRom(0x82f7f7)+index*2)*2;assert.deepEqual(handicap.vram.slice(dest,dest+64),decompress(rom,loRom(EXPANDED.labels)+team*69),`Handicap label ${team}`);}
 assert.ok(decompress(rom,loRom(EXPANDED.labels)+54*69).some(Boolean));
 const game=run(expanded,'match-55',10000,[...last,[3300,10,8],[3500,10,8],[3800,10,8],[4300,10,3],[4500,10,8],[4800,10,8],[5800,10,3],[6100,10,8],[8000,10,8],[8300,10,8],[8600,10,8],[9000,10,3]]);
 assert.equal(game.ram[0xda0]|game.ram[0xda1]<<8,110);assert.equal(game.ram[0xea0]|game.ram[0xea1]<<8,4);
 assert.deepEqual(game.ram.slice(0xd478,0xd540),rom.slice(loRom(EXPANDED.names)+55*200,loRom(EXPANDED.names)+56*200),'All twenty 10-character home names must load in the real match');
 assert.deepEqual(game.ram.slice(0xd540,0xd608),rom.slice(loRom(EXPANDED.names)+2*200,loRom(EXPANDED.names)+3*200),'The away names must remain separate');
 // Inspect what the PPU actually receives, beyond the copied name pool.
 const name=rom.slice(loRom(EXPANDED.names)+55*200,loRom(EXPANDED.names)+55*200+10);
 for(let i=0;i<10;i++)for(let row=0;row<2;row++)assert.equal(word(game.vram,(0x5b01+row*32+i)*2),0x2000|rom[loRom(0x878000)+name[i]*2+row],`Visible HUD name tile ${row}:${i}`);
 await require('./hack-roms-runtime.cjs')(core);
 console.log(`PASS expanded runtime: stock main menu pixels/background/OAM, selector palettes, squad 55, all 56 flag/label caches, 691 name sprites and I. MILAN in handicap and a match with twenty 10-character names rendered into VRAM. Captures: ${directory}`);
})().catch(e=>{console.error(e);process.exitCode=1;});
