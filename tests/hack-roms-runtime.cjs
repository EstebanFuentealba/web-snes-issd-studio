const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
global.crypto ||= require('node:crypto').webcrypto;
module.exports=async function hackRomsRuntime(core){
 const {RomProject}=await import('../src/rom/project.mjs'),{playerPatches}=await import('../src/rom/players.mjs'),{deluxePlayerNameOffset}=await import('../src/rom/deluxe.mjs'),{word,loRom}=await import('../src/rom/binary.mjs');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'issd-hacks-runtime-'));
 const events=[[400,20,3],[600,20,3],[800,20,3],[1100,20,8],[1300,20,8],[1500,20,8],[3300,10,8],[3500,10,8],[3800,10,8],[4300,10,3],[4500,10,8],[4800,10,8],[5800,10,3],[6100,10,8],[8000,10,8],[8300,10,8],[8600,10,8],[10300,10,8],[10600,10,3],[10900,10,8],[11200,10,8]];
 function run(file,id){
  const output=path.join(directory,id),result=spawnSync(process.env.PYTHON||'python3',[path.join(__dirname,'snes9x-headless.py'),path.resolve(core),file,output],{encoding:'utf8',timeout:60000,env:{...process.env,ISSD_FRAMES:'14000',ISSD_INPUT:JSON.stringify(events)}});
  assert.equal(result.status,0,`${id}: ${result.stderr}`);
  const meta=JSON.parse(result.stdout.split('\n').find(l=>l.startsWith('{')));assert.equal(meta.width,256);assert.equal(meta.height,224);
  return {ram:fs.readFileSync(output+'.ram'),vram:fs.readFileSync(output+'.vram')};
 }
 const fixtures=require('./local-hack-roms.cjs')();
 for(const [index,{name,file}] of fixtures.entries()){
  const original=run(file,`${index}-original`),team=original.ram.readUInt16LE(0xda0)/2,away=original.ram.readUInt16LE(0xea0)/2;
  assert.ok(Number.isInteger(team)&&team>=0&&team<36,`${name}: national team selected`);
  const project=await RomProject.create(fs.readFileSync(file));
  const roster=rom=>Buffer.concat(Array.from({length:20},(_,i)=>Buffer.from(rom.slice(deluxePlayerNameOffset(rom,team,i),deluxePlayerNameOffset(rom,team,i)+8))));
  assert.deepEqual(original.ram.subarray(0xd478,0xd518),roster(project.original),`${name}: original roster in a real match`);
  project.transaction(Array.from({length:20},(_,i)=>playerPatches(project.bytes(),team,i,{name:'TEST'})).flat());
  const exported=path.join(directory,`${index}-edited.sfc`);fs.writeFileSync(exported,project.exportRom());
  const edited=run(exported,`${index}-edited`);
  assert.equal(edited.ram.readUInt16LE(0xda0),team*2);assert.equal(edited.ram.readUInt16LE(0xea0),away*2);
  assert.deepEqual(edited.ram.subarray(0xd478,0xd518),roster(project.bytes()),`${name}: twenty edited names loaded by Snes9x`);
  assert.deepEqual(edited.ram.subarray(0xd518,0xd5b8),original.ram.subarray(0xd518,0xd5b8),`${name}: away roster preserved`);
  const rom=project.bytes(),offset=deluxePlayerNameOffset(rom,team,0);
  // Native HUD names are padded/centered; find the first letter within its
  // eight-column player fields (possession can swap sides), then require both rows.
  const column=[...Array.from({length:5},(_,i)=>i),...Array.from({length:5},(_,i)=>21+i)].find(c=>Array.from({length:4},(_,i)=>i).every(i=>word(edited.vram,(0x5b01+c+i)*2)===(0x2000|rom[loRom(0x878000)+rom[offset+i]*2])));
  assert.notEqual(column,undefined,`${name}: TEST visible in the match HUD`);
  for(let i=0;i<4;i++)for(let row=0;row<2;row++)assert.equal(word(edited.vram,(0x5b01+column+row*32+i)*2),0x2000|rom[loRom(0x878000)+rom[offset+i]*2+row],`${name}: HUD tile ${row}:${i} in VRAM`);
  console.log(`PASS hack runtime: ${name}: original/edited match, 20 names in RAM and TEST in VRAM`);
 }
 if(!fixtures.length)console.log('No local hack fixtures available; only the USA runtime was verified.');
 console.log(`Hack runtime captures: ${directory}`);
};
