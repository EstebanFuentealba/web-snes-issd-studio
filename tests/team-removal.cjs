const assert=require('assert/strict'),fs=require('fs');
global.crypto ||= require('crypto').webcrypto;
(async()=>{
 const {RomProject}=await import('../src/rom/project.mjs');
 const {editableGroups,editGroupsPatches}=await import('../src/rom/group-editor.mjs');
 const {readDeluxeTeam}=await import('../src/rom/deluxe.mjs');
 const {teamCount}=await import('../src/rom/team-count.mjs');
 const {readScenarios}=await import('../src/rom/scenarios.mjs');
 const filename='roms/International Superstar Soccer Deluxe (USA).sfc';
 if(!fs.existsSync(filename)){console.log('SKIP team removal: local USA ROM unavailable');return;}
 const original=new Uint8Array(fs.readFileSync(filename)),p=await RomProject.create(original);
 const stock=editableGroups(p.bytes()),squad=readDeluxeTeam(p.bytes(),0),scenarios=readScenarios(p.bytes());
 const before=p.exportRom();
 for(const id of [-1,42,0.5,NaN])assert.throws(()=>p.removeTeam(id),/Equipo inválido/);
 assert.deepEqual(p.exportRom(),before);assert.equal(p.canUndo,false);
 p.removeTeam(0);
 assert.deepEqual(editableGroups(p.bytes()),stock.map(g=>({...g,teams:g.teams.filter(id=>id!==0)})));
 assert.deepEqual(readDeluxeTeam(p.bytes(),0),squad);
 assert.deepEqual(readScenarios(p.bytes()),scenarios);assert.equal(teamCount(p.bytes()),42);
 const removed=p.exportRom();assert.throws(()=>p.removeTeam(0),/ya está fuera/);assert.deepEqual(p.exportRom(),removed);
 p.undo();assert.deepEqual(p.exportRom(),original);p.redo();assert.deepEqual(p.exportRom(),removed);
 const imported=await RomProject.import(JSON.parse(JSON.stringify(p.record())));
 assert.deepEqual(imported.exportRom(),removed);
 const reopened=await RomProject.create(removed);assert.ok(editableGroups(reopened.bytes()).every(g=>!g.teams.includes(0)));
 // Remove every occurrence, retain empty group headings and four-column layout.
 const groups=[{name:'UNO',teams:[0,1]},{name:'DOS',teams:[0]},{name:'VACIO',teams:[]}];
 p.transaction(editGroupsPatches(original,p.bytes(),groups,4));p.removeTeam(0);
 assert.deepEqual(editableGroups(p.bytes()),[{name:'UNO',teams:[1]},{name:'DOS',teams:[]},{name:'VACIO',teams:[]}]);
 const last=p.exportRom();assert.throws(()=>p.removeTeam(1),/al menos un equipo/);assert.deepEqual(p.exportRom(),last);
 p.addTeam('CHILE');const added=p.exportRom(),extra=readDeluxeTeam(p.bytes(),42);
 p.removeTeam(42);assert.ok(editableGroups(p.bytes()).every(g=>!g.teams.includes(42)));
 assert.equal(teamCount(p.bytes()),43);assert.deepEqual(readDeluxeTeam(p.bytes(),42),extra);
 const extraRemoved=p.exportRom();const extraReopened=await RomProject.create(extraRemoved);
 assert.equal(teamCount(extraReopened.bytes()),43);assert.ok(editableGroups(extraReopened.bytes()).every(g=>!g.teams.includes(42)));
 p.undo();assert.deepEqual(p.exportRom(),added);p.redo();assert.deepEqual(p.exportRom(),extraRemoved);
 console.log('PASS team removal: stock/extra squads, all memberships, empty groups, atomic rejection, data preservation, undo/redo, project and ROM reopening');
})().catch(e=>{console.error(e);process.exitCode=1;});
