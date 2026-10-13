const assert=require('assert/strict'),fs=require('fs'),path=require('path');
global.crypto ||= require('crypto').webcrypto;
(async()=>{
 const {RomProject}=await import('../src/rom/project.mjs');
 const {teamCount,teamPointer,attributeOffset,TEAM_METADATA,EXTRA_BIG_LABEL_ADDRESS}=await import('../src/rom/team-count.mjs');
 const {readDeluxeTeam}=await import('../src/rom/deluxe.mjs');
 const {playerOffsets,playerPatches}=await import('../src/rom/players.mjs');
 const {readFormation,formationPatch}=await import('../src/rom/formations.mjs');
 const {teamNameTexts,bigLabel,bigTeamNamePatches,restoreTeamLabelPatches,labelLayout,labelFrame}=await import('../src/rom/team-labels.mjs');
 const {flagMatrix,flagPatches,smallLabelMatrix,flagPalettePatches,rgb555,compress}=await import('../src/rom/graphics.mjs');
 const {editableGroups,editGroupsPatches}=await import('../src/rom/group-editor.mjs');
 const {loRom,word,decompress}=await import('../src/rom/binary.mjs');
 const filename=path.join(__dirname,'../roms/International Superstar Soccer Deluxe (USA).sfc');
 if(!fs.existsSync(filename)){console.log('SKIP extra teams: local USA ROM unavailable');return;}
 const original=new Uint8Array(fs.readFileSync(filename)),p=await RomProject.create(original),stock=readDeluxeTeam(original,0);
 assert.throws(()=>p.addTeam('ABCDEFGHIJ'),/no cabe/);assert.deepEqual(p.exportRom(),original);assert.equal(p.canUndo,false);
 p.addTeam('CHILE');assert.equal(teamCount(p.bytes()),43);assert.equal(readDeluxeTeam(p.bytes(),42).sharedPlayerNames,false);
 assert.deepEqual(readDeluxeTeam(p.bytes(),42).players,stock.players);
 assert.deepEqual(teamNameTexts(original,p.bytes(),42),{small:'CHILE',large:'CHILE'});
 assert.ok(editableGroups(p.bytes()).some(g=>g.name==='EXTRA'&&g.teams.includes(42)));
 // Visible glyphs must be centered even though new frames have x=0 padding.
 const visibleLeft=(rom,team)=>{const l=labelLayout(rom),f=labelFrame(l,team);return Math.min(...Array.from({length:f.count},(_,i)=>l.base+f.start+i).filter(i=>l.data[i+l.sprites*2]!==170).map(i=>l.data[i]-(l.data[i+l.sprites*3]&16?4:0)));};
 assert.equal(visibleLeft(p.bytes(),42),20);

 p.undo();assert.equal(teamCount(p.bytes()),42);assert.deepEqual(p.exportRom(),original);p.redo();assert.equal(teamCount(p.bytes()),43);
 for(let i=0;i<42;i++){
  assert.deepEqual(readDeluxeTeam(p.bytes(),i).players,readDeluxeTeam(original,i).players);
  assert.deepEqual(flagMatrix(p.bytes(),i),flagMatrix(original,i));
  assert.deepEqual(smallLabelMatrix(p.bytes(),i),smallLabelMatrix(original,i));
  assert.deepEqual(bigLabel(p.bytes(),i).matrix,bigLabel(original,i).matrix);
 }
 for(const name of ['PERU','BOLIVIA','ECUADOR','CANADA','CUBA'])p.addTeam(name);
 assert.equal(teamCount(p.bytes()),48);p.addTeam('USA');assert.equal(teamCount(p.bytes()),49);p.undo();assert.equal(teamCount(p.bytes()),48);
 for(let t=42;t<48;t++){assert.equal(readDeluxeTeam(p.bytes(),t).players.length,20);assert.ok(readFormation(p.bytes(),t).label);}
 p.transaction(bigTeamNamePatches(original,p.bytes(),42,'U.CHILE'));assert.equal(visibleLeft(p.bytes(),42),14);
 p.transaction(bigTeamNamePatches(original,p.bytes(),42,'LOTA'));assert.equal(visibleLeft(p.bytes(),42),24);
 p.transaction(bigTeamNamePatches(original,p.bytes(),42,'CHILE'));assert.equal(visibleLeft(p.bytes(),42),20);
 // Earlier saved projects must retain names while repairing their x=0 anchor.
 const bitten=JSON.parse(JSON.stringify(p.record())),l=labelLayout(p.bytes()),f=labelFrame(l,42);
 for(let i=0;i<f.count;i++)l.data[l.base+f.start+i]=Math.max(0,l.data[l.base+f.start+i]-20);
 const encoded=compress(l.data),storage=new Uint8Array(3000).fill(255);storage.set(encoded);
 bitten.patches.find(r=>r.id==='teams:big-labels').bytes=Buffer.from(storage).toString('base64');
 const aligned=await RomProject.import(bitten);assert.equal(visibleLeft(aligned.bytes(),42),20);assert.equal(teamNameTexts(original,aligned.bytes(),42).large,'CHILE');
 const bittenRom=p.exportRom();bittenRom.set(storage,loRom(EXTRA_BIG_LABEL_ADDRESS));const alignedRom=await RomProject.create(bittenRom);assert.equal(visibleLeft(alignedRom.bytes(),42),20);assert.deepEqual(alignedRom.exportOriginal(),bittenRom);

 const rom=p.bytes(),changes=playerPatches(rom,47,0,{name:'Nuevo',speed:2,no:2});p.transaction(changes);
 assert.equal(readDeluxeTeam(p.bytes(),47).players[0].name,'Nuevo');assert.equal(readDeluxeTeam(p.bytes(),47).players[0].no,2);
 assert.deepEqual(readDeluxeTeam(p.bytes(),42).players,stock.players);assert.deepEqual(readDeluxeTeam(p.bytes(),0).players,stock.players);
 const flag=flagMatrix(p.bytes(),47);flag[0][0]=flag[0][0]===12?13:12;p.transaction(flagPatches(original,p.bytes(),47,flag));assert.deepEqual(flagMatrix(p.bytes(),47),flag);assert.deepEqual(flagMatrix(p.bytes(),42),stock.flag);
 const colors=readDeluxeTeam(p.bytes(),47).colors;colors[12]='#ff0000';p.transaction(flagPalettePatches(p.bytes(),47,colors));assert.equal(readDeluxeTeam(p.bytes(),47).colors[12],'#ff0000');assert.deepEqual(readDeluxeTeam(p.bytes(),42).colors,stock.colors);
 p.transaction(bigTeamNamePatches(original,p.bytes(),47,'COSTA RICA'));assert.equal(teamNameTexts(original,p.bytes(),47).large,'COSTA RICA');
 p.transaction([formationPatch(p.bytes(),47,8)]);assert.deepEqual(readFormation(p.bytes(),47).bytes,readFormation(original,8).bytes);
 const offsets=playerOffsets(p.bytes(),47,0);p.transaction([...p.restorePatches(`name:${offsets.name}`),...p.restorePatches(`attributes:${offsets.attributes}`)]);assert.equal(readDeluxeTeam(p.bytes(),47).players[0].name,stock.players[0].name);
 p.restore(readFormation(p.bytes(),47).id);assert.deepEqual(readFormation(p.bytes(),47).bytes,readFormation(original,0).bytes);
 const paletteOffset=loRom(0x890000|teamPointer(p.bytes(),0xe7d8,47))+2;p.restore(`palette:${paletteOffset}`);assert.deepEqual(readDeluxeTeam(p.bytes(),47).colors,stock.colors);
 // Every relocated selection DMA descriptor must fit and remain disjoint.
 const ranges=[];for(const [start,n] of [[loRom(0x82fb5d),96],[loRom(0x82fda1),48]]){
  assert.equal(word(rom,start),1);assert.equal(word(rom,start+2+n*6),65535);
  for(let i=0;i<n;i++){const off=start+2+i*6,dest=word(rom,off),source=word(rom,off+3)|rom[off+5]<<16,data=decompress(rom,loRom(source));assert.equal(rom[off+2],0x7f);const end=dest+data.length;assert.ok(!ranges.some(([a,b])=>dest<b&&a<end));ranges.push([dest,end]);}
 }
 const exported=p.exportRom();assert.equal(exported.length,original.length);assert.equal(word(exported,0x7fde),exported.reduce((n,b)=>(n+b)&65535,0));
 const imported=await RomProject.import(JSON.parse(JSON.stringify(p.record())));assert.deepEqual(imported.exportRom(),exported);
 const legacy=JSON.parse(JSON.stringify(p.record()));legacy.patches=legacy.patches.filter(p=>!p.id.startsWith('teams:photo-')&&!['teams:small-oam:86c66d','teams:small-oam:86c6ab'].includes(p.id));const upgraded=await RomProject.import(legacy);assert.deepEqual(upgraded.exportRom(),exported);
 const reopened=await RomProject.create(exported);assert.equal(teamCount(reopened.bytes()),48);reopened.transaction(playerPatches(reopened.bytes(),42,0,{speed:3}));assert.equal(readDeluxeTeam(reopened.bytes(),42).players[0].speed,3);
 const before=p.exportRom(),meta=p.patches.find(r=>r.id==='teams:metadata');meta.bytes[5]=49;assert.throws(()=>p.transaction([meta]),/Cantidad/);assert.deepEqual(p.exportRom(),before);
 const bad=p.patches.find(r=>r.id==='teams:tables');bad.bytes[0]^=1;assert.throws(()=>p.transaction([bad]),/Tabla original/);assert.deepEqual(p.exportRom(),before);
 const badPhoto=p.patches.find(r=>r.id==='teams:photo-tables');badPhoto.bytes[0]^=1;assert.throws(()=>p.transaction([badPhoto]),/fotografía/);assert.deepEqual(p.exportRom(),before);
 const header=new Uint8Array(original.length+512);header.fill(0x5a,0,512);header.set(original,512);const smc=await RomProject.create(header);smc.addTeam('CHILE');assert.deepEqual(smc.exportRom().slice(0,512),header.slice(0,512));
 fs.writeFileSync('/private/tmp/issd-extra-test.sfc',exported);
 console.log('PASS extra teams: 43–48 independent squads/palettes/flags/formations/names, original 42 preservation, disjoint native DMA buffers, atomic rejection/history, project and ROM reopening, checksum and copier header');
})().catch(e=>{console.error(e);process.exitCode=1;});
