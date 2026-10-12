const assert=require('assert/strict'),fs=require('fs'),path=require('path');
global.crypto ||= require('crypto').webcrypto;
(async()=>{
 const {FORMATION_LABELS,readFormation,readFormationPreset,formationPresetPatch,customFormationPatch,validateFormation,formationPoint,formationSlotAt}=await import('../src/rom/formations.mjs');
 const {RomProject}=await import('../src/rom/project.mjs');
 const file=path.resolve(__dirname,'../roms/International Superstar Soccer Deluxe (USA).sfc');
 if(!fs.existsSync(file)){console.log('SKIP formations local ROM tests');return;}
 const original=new Uint8Array(fs.readFileSync(file)),project=await RomProject.create(original);
 assert.equal(FORMATION_LABELS.length,16);
 for(let i=0;i<16;i++){
  const preset=readFormationPreset(original,i),counts=[0,0,0];
  for(const slot of preset.slots){counts[slot.role===1||slot.role===5?0:slot.role===2||slot.role===6?1:2]++;assert.ok(Math.abs(slot.depth)<=16&&Math.abs(slot.width)<=32);}
  assert.equal(counts.join('-'),FORMATION_LABELS[i],'The printed scheme matches its ten player roles');
  const before=project.bytes();
  const patch=formationPresetPatch(before,0,i,original);
  project.transaction([patch]);
  assert.deepEqual(readFormation(project.bytes(),0).bytes,preset.bytes);
  assert.deepEqual(readFormation(project.bytes(),8),readFormation(original,8),'Other teams retain their formation');
  assert.deepEqual(project.bytes().slice(0,patch.offset),before.slice(0,patch.offset));
  assert.deepEqual(project.bytes().slice(patch.offset+31),before.slice(patch.offset+31));
  project.undo();assert.deepEqual(project.bytes(),before);
  project.redo();assert.deepEqual(readFormation(project.bytes(),0).bytes,preset.bytes);
 }
 const exported=project.exportRom(),reopened=await RomProject.create(exported);
 assert.equal(readFormation(reopened.bytes(),0).label,'1-4-5');
 const imported=await RomProject.import(JSON.parse(JSON.stringify(project.record())));
 assert.deepEqual(imported.exportRom(),exported);
 const bad=formationPresetPatch(project.bytes(),0,6,original);bad.bytes[1]=127;
 assert.throws(()=>project.transaction([bad]),/límites/);
 assert.deepEqual(project.exportRom(),exported,'Invalid coordinates are rejected atomically');
 const wrongLabel=formationPresetPatch(project.bytes(),0,6,original);wrongLabel.bytes[0]=7;
 assert.throws(()=>project.transaction([wrongLabel]),/Roles/);
 for(const value of [-1,16,1.5,'1',NaN])assert.throws(()=>readFormationPreset(original,value),/inválida/);
 assert.throws(()=>readFormationPreset(new Uint8Array(20),0),/fuera/);
 // Custom movement and attacking roles survive both export formats.
 const custom=readFormationPreset(original,1);custom.slots[0]={depth:19,width:-40,role:5};custom.slots[4]={depth:-23,width:40,role:6};
 const edited=customFormationPatch(project.bytes(),0,1,custom.slots);project.transaction([edited]);
 const customBytes=project.exportRom();const customReloaded=await RomProject.create(customBytes);
 assert.deepEqual(readFormation(customReloaded.bytes(),0).slots,custom.slots);
 const customImported=await RomProject.import(JSON.parse(JSON.stringify(project.record())));
 assert.deepEqual(readFormation(customImported.bytes(),0).slots,custom.slots);
 project.undo();assert.deepEqual(project.exportRom(),exported);project.redo();
 for(let i=0;i<42;i++)validateFormation(readFormation(original,i).bytes);
 for(const slot of custom.slots){const p=formationPoint(slot);assert.deepEqual(formationSlotAt(slot,p.x,p.y),slot);}
 assert.deepEqual(formationSlotAt(custom.slots[0],1000,-1000),{depth:19,width:-40,role:5});
 assert.throws(()=>customFormationPatch(project.bytes(),0,1,custom.slots.map((s,i)=>i? s:{...s,depth:20})),/límites/);
 assert.throws(()=>customFormationPatch(project.bytes(),0,1,custom.slots.map((s,i)=>i? s:{...s,depth:256})),/límites/);
 assert.throws(()=>customFormationPatch(project.bytes(),0,1,custom.slots.map((s,i)=>i? s:{...s,role:257})),/Roles/);
 assert.throws(()=>customFormationPatch(project.bytes(),0,1,custom.slots.map((s,i)=>i===9?{...s,role:7}:s)),/Roles/);
 project.restore(readFormation(project.bytes(),0).id);assert.deepEqual(project.exportRom(),original);
 project.addTeam('Test');const rom=project.bytes(),extra=formationPresetPatch(rom,42,10,original);
 project.transaction([extra]);assert.equal(readFormation(project.bytes(),42).label,'2-3-5');
 const extraReopened=await RomProject.create(project.exportRom());assert.deepEqual(readFormation(extraReopened.bytes(),42).bytes,readFormationPreset(original,10).bytes);
 console.log('PASS formations: 16 native menu schemes, role counts, isolated writes, undo/redo, restore, ROM/project reopening, extra teams, custom positions/attack roles, coordinate conversion and atomic rejection');
})().catch(e=>{console.error(e);process.exitCode=1;});
