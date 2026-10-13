const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
global.crypto ||= require('node:crypto').webcrypto;
(async()=>{
 const {openRom}=await import('../src/rom/binary.mjs');
 const {RomProject}=await import('../src/rom/project.mjs');
 const {readDeluxeTeam}=await import('../src/rom/deluxe.mjs');
 const {teamNameTexts}=await import('../src/rom/team-labels.mjs');
 const {playerPatches}=await import('../src/rom/players.mjs');
 const {graphicResources,graphicPatches}=await import('../src/rom/graphics.mjs');
 const {AUDIO_SAMPLES,readAudioSample}=await import('../src/rom/audio.mjs');
 const {editorCompatibility}=await import('../src/rom/compatibility.mjs');
 assert.throws(()=>openRom(new Uint8Array(0x200000)),/compatible/);
 const baseFile=path.join(__dirname,'../roms/International Superstar Soccer Deluxe (USA).sfc');
 if(!fs.existsSync(baseFile)){console.log('SKIP hack local ROM tests');return;}
 const base=openRom(fs.readFileSync(baseFile)).rom;
 assert.equal(openRom(base).isHack,false);
 assert.ok(Object.values(editorCompatibility(base)).every(feature=>feature.supported));
 const changed=base.slice();changed.fill(0,0x7fc0,0x7fda);
 assert.equal(openRom(changed).isHack,true);
 const renamed=base.slice();renamed.set(Buffer.from('CUSTOM ISSD HACK      '),0x7fc0);assert.equal(openRom(renamed).isHack,true);
 const oneRoutine=changed.slice();oneRoutine.fill(0,0,16);assert.equal(openRom(oneRoutine).isHack,true);
 const wrongEngine=changed.slice();wrongEngine.fill(0,0,16);wrongEngine.fill(0,0x20000,0x20010);assert.throws(()=>openRom(wrongEngine),/compatible/);
 const bigger=new Uint8Array(0x280000).fill(255);bigger.set(changed);assert.equal(openRom(bigger).isHack,true);
 assert.throws(()=>openRom(new Uint8Array(0x280000)),/compatible/);
 const brokenPointers=changed.slice();brokenPointers.fill(0,0xe6c1,0xe6c3);assert.throws(()=>openRom(brokenPointers),/compatible/);
 assert.throws(()=>openRom(changed.subarray(0,changed.length-1)),/compatible/);
 const legacyNumbers=changed.slice();legacyNumbers[0x50000+7+5]=legacyNumbers[0x50000+5];
 const legacyProject=await RomProject.create(legacyNumbers);
 assert.doesNotThrow(()=>legacyProject.transaction(playerPatches(legacyProject.bytes(),0,0,{name:'TEST'})));
 assert.throws(()=>legacyProject.transaction(playerPatches(legacyProject.bytes(),0,2,{no:legacyNumbers[0x50000+5]+1},false)),/únicos/);
 const sources=[['synthetic erased header',changed],['synthetic legacy numbers',legacyNumbers]];
 for(const {name,file} of require('./local-hack-roms.cjs')())sources.push([name,new Uint8Array(fs.readFileSync(file))]);
 for(const [name,input] of sources){
  const session=openRom(input),project=await RomProject.create(input);
  assert.equal(session.game,'issd');assert.equal(session.isHack,true);
  assert.deepEqual(project.exportOriginal(),input);assert.deepEqual(project.exportRom(),input);
  for(let t=0;t<42;t++)assert.equal(readDeluxeTeam(project.bytes(),t).players.length,20);
  for(const sample of AUDIO_SAMPLES)readAudioSample(project.bytes(),sample);
  const warnings=[],resources=graphicResources(project.bytes(),0,warnings),label=resources.find(r=>r.kind==='label');
  if(/Brasileiro|Ronaldinho/.test(name)){
   assert.equal(session.headerSize,512);assert.equal(label.matrix.length,16);assert.ok(warnings.length);
   const capabilities=editorCompatibility(project.bytes());assert.equal(capabilities.largeNames.supported,false);assert.equal(capabilities.menus.supported,false);assert.equal(capabilities.scenarios.supported,false);
   // Native 16px labels can be drawn without changing loaders/pointers/pools.
   project.transaction(graphicPatches(project.original,project.bytes(),label,label.matrix.map(row=>row.map(()=>0))));
   const reopened=openRom(project.exportRom());assert.equal(graphicResources(reopened.rom,0).find(r=>r.kind==='label').matrix.length,16);
   project.undo();assert.deepEqual(project.exportRom(),input);
  }
  // A malformed legacy flag/label disables only that graphic, never rosters.
  for(let t=0;t<42;t++){assert.doesNotThrow(()=>teamNameTexts(project.original,project.bytes(),t));const warnings=[];const resources=graphicResources(project.bytes(),t,warnings),team=readDeluxeTeam(project.bytes(),t);for(const warning of team.graphicWarnings||[]){assert.ok(warnings.some(w=>w.resource===warning.resource));assert.ok(!resources.some(r=>r.kind===(warning.resource==='Bandera del equipo'?'flag':'label')));}}
  project.transaction(playerPatches(project.bytes(),0,0,{name:'TEST'}));
  const exported=project.exportRom();assert.equal(exported.length,input.length);
  assert.deepEqual(exported.subarray(0,session.headerSize),input.subarray(0,session.headerSize));
  // No header repair or unrelated ROM changes: only name and checksum bytes.
  const namePatch=project.patches[0];for(let i=0;i<input.length;i++)if(exported[i]!==input[i])assert.ok(i>=session.headerSize+namePatch.offset&&i<session.headerSize+namePatch.offset+8||i>=session.headerSize+0x7fdc&&i<session.headerSize+0x7fe0);
  assert.equal(readDeluxeTeam(openRom(exported).rom,0).players[0].name,'TEST');
  const restored=await RomProject.import(project.record(),input);assert.deepEqual(restored.exportRom(),exported);
  project.undo();assert.deepEqual(project.exportRom(),input);project.redo();assert.deepEqual(project.exportRom(),exported);
  console.log(`PASS hack ROM: ${name}: 42 teams, 76 BRR samples, edit/export/project/undo`);
 }
})();
