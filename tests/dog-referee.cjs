const assert=require('assert/strict'),fs=require('fs');
global.crypto ||= require('crypto').webcrypto;
(async()=>{
 const {RomProject}=await import('../src/rom/project.mjs');
 const {DOG_REFEREE_RULES,dogRefereeMode,dogRefereePatches}=await import('../src/rom/dog-referee.mjs');
 const file='roms/International Superstar Soccer Deluxe (USA).sfc';
 if(!fs.existsSync(file)){console.log('SKIP dog referee: local ROM unavailable');return;}
 const original=new Uint8Array(fs.readFileSync(file)),project=await RomProject.create(original);
 assert.equal(dogRefereeMode(original),'original');
 // The catalog must cover every native flag read (sprites, sound and palettes).
 const reads=[];
 for(let i=0;i<original.length-3;i++)if([0xaf,0x54,0xd8,0x7e].every((v,j)=>original[i+j]===v))reads.push(i);
 assert.deepEqual(DOG_REFEREE_RULES.map(r=>r[1]),reads);
 for(const enabled of [true,false]){
  project.transaction(dogRefereePatches(project.bytes(),enabled));
  const rom=project.bytes();assert.equal(dogRefereeMode(rom),enabled?'enabled':'disabled');
  // Execute each replacement with the cheat flag clear and set: 16-bit LDA
  // sets A and Z; NOP preserves flags for the following branch or transfer.
  for(const [,offset] of DOG_REFEREE_RULES)for(const cheat of [0,1]){
   let a=cheat,z=!a,pc=offset;
   assert.equal(rom[pc++],0xa9);a=rom[pc++]|rom[pc++]<<8;z=a===0;
   assert.equal(rom[pc++],0xea);assert.equal(pc,offset+4);
   assert.equal(a,Number(enabled));assert.equal(z,!enabled);
  }
  const allowed=new Set(DOG_REFEREE_RULES.flatMap(([,o])=>[o,o+1,o+2,o+3]));
  for(let i=0;i<rom.length;i++)if(!allowed.has(i))assert.equal(rom[i],original[i]);
  const exported=project.exportRom();assert.equal(dogRefereeMode(exported),enabled?'enabled':'disabled');
  assert.deepEqual((await RomProject.import(project.record())).bytes(),rom);
  project.undo();project.redo();assert.deepEqual(project.bytes(),rom);
  // Restoring any entry restores the entire setting atomically.
  project.restore(DOG_REFEREE_RULES[0][0]);assert.deepEqual(project.exportRom(),original);
 }
 const forged=dogRefereePatches(original,true);forged[0].bytes[3]=0x60;
 assert.throws(()=>project.transaction(forged),/árbitro perro/);
 assert.throws(()=>project.transaction(dogRefereePatches(original,true).slice(0,1)),/árbitro perro/);
 assert.deepEqual(project.bytes(),original);
 const header=new Uint8Array(original.length+512);header.set(original,512);
 const headerProject=await RomProject.create(header);headerProject.transaction(dogRefereePatches(headerProject.bytes(),true));
 assert.equal(headerProject.exportRom().length,header.length);
 assert.equal(dogRefereeMode(headerProject.exportRom().slice(512)),'enabled');
 console.log('PASS dog referee: all 12 flag reads, enabled/disabled execution, cheat independence, validation, history, restore, import/export and copier header');
})().catch(e=>{console.error(e);process.exitCode=1;});
