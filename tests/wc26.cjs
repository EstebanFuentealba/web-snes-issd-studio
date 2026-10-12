const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
global.crypto ||= require('node:crypto').webcrypto;
(async()=>{
 const {openRom}=await import('../src/rom/binary.mjs');const {externalDeluxeLayout}=await import('../src/rom/external-layout.mjs');
 const {RomProject}=await import('../src/rom/project.mjs');const {readDeluxeTeam}=await import('../src/rom/deluxe.mjs');
 const {teamCount,attributeOffset}=await import('../src/rom/team-count.mjs');const {playerPatches,playerOffsets}=await import('../src/rom/players.mjs');
 const file=process.env.ISSD_WC26_ROM||path.join(require('node:os').homedir(),'Downloads/ISSDWC26RC1GB2.0.sfc');
 if(!fs.existsSync(file)){console.log('SKIP WC26 local ROM tests');return;}
 const input=new Uint8Array(fs.readFileSync(file)),session=openRom(input),project=await RomProject.create(input);
 assert.equal(session.layout,'wc26-56');assert.equal(teamCount(session.rom),56);assert.equal(externalDeluxeLayout(session.rom,true).nameLength,10);
 assert.deepEqual(project.exportOriginal(),input);assert.deepEqual(project.exportRom(),input);
 assert.equal(readDeluxeTeam(session.rom,0).players[0].name,'Unai Simon');assert.equal(readDeluxeTeam(session.rom,1).players[0].name,'M.Neuer');
 for(let t=0;t<56;t++){const team=readDeluxeTeam(session.rom,t);assert.equal(team.players.length,20);assert.ok(team.players.every(p=>!p.name.includes('�')));}
 const offset=playerOffsets(session.rom,55,0);assert.equal(attributeOffset(session.rom,55),0x150000+55*140);
 project.transaction(playerPatches(project.bytes(),55,0,{name:'Test-NameX',speed:8}));
 const exported=project.exportRom();assert.equal(exported.length,input.length);assert.equal(readDeluxeTeam(openRom(exported).rom,55).players[0].name,'Test-NameX');
 for(let i=0;i<input.length;i++)if(input[i]!==exported[i])assert.ok(i>=offset.name&&i<offset.name+10||i>=offset.attributes&&i<offset.attributes+7||i>=0x7fdc&&i<0x7fe0,`Unexpected write: ${i.toString(16)}`);
 assert.throws(()=>playerPatches(project.bytes(),0,0,{name:'12345678901'}),/10 caracteres/);
 assert.throws(()=>project.transaction([{id:'graphic:0',offset:0,bytes:new Uint8Array(1)}]),/no permitido/);
 assert.deepEqual((await RomProject.import(project.record(),input)).exportRom(),exported);
 project.undo();assert.deepEqual(project.exportRom(),input);project.redo();assert.deepEqual(project.exportRom(),exported);
 const bad=input.slice();bad[0x4f4a]=0x87;assert.equal(externalDeluxeLayout(bad,true),null);assert.throws(()=>openRom(bad),/compatible/);
 const badNames=input.slice();badNames[playerOffsets(input,0,0).name]=255;assert.equal(externalDeluxeLayout(badNames,true),null);assert.throws(()=>openRom(badNames),/compatible/);
 const headered=new Uint8Array(input.length+512);headered.set(input,512);assert.equal(openRom(headered).layout,'wc26-56');assert.deepEqual((await RomProject.create(headered)).exportRom(),headered);
 console.log('PASS WC26: 56 relocated squads, 10-character names, attributes, strict profile detection, write boundaries, recovery, header and undo/redo');
})();
