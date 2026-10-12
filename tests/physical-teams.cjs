const assert=require('assert/strict'),fs=require('fs');
global.crypto ||= require('crypto').webcrypto;
(async()=>{
 const {RomProject}=await import('../src/rom/project.mjs');
 const {activeTeamIds,teamExists,teamCount,teamPointer,attributeOffset,TEAM_METADATA,PHYSICAL_STAR_NAMES}=await import('../src/rom/team-count.mjs');
 const {erasedNativeResources,SHARED_BLANK_DETAIL}=await import('../src/rom/physical-teams.mjs');
 const {readDeluxeTeam,deluxePlayerNameOffset}=await import('../src/rom/deluxe.mjs');
 const {editableGroups,editGroupsPatches}=await import('../src/rom/group-editor.mjs');
 const {readScenarios}=await import('../src/rom/scenarios.mjs');
 const {teamNameTexts,bigLabel,smallTeamNamePatches,bigTeamNamePatches,previewBigTeamText}=await import('../src/rom/team-labels.mjs');
 const {playerPatches,playerOffsets}=await import('../src/rom/players.mjs');
 const {flagPatches,flagMatrix}=await import('../src/rom/graphics.mjs');
 const {loRom,word,decompress}=await import('../src/rom/binary.mjs');
 const {readStadiums}=await import('../src/rom/stadiums.mjs');
 const file='roms/International Superstar Soccer Deluxe (USA).sfc';if(!fs.existsSync(file)){console.log('SKIP physical deletion: local USA ROM unavailable');return;}
 const original=new Uint8Array(fs.readFileSync(file)),p=await RomProject.create(original),stars=Array.from({length:6},(_,i)=>readDeluxeTeam(original,36+i).players);
 // Reused native frames encode spaces as gaps and may contain transparent
 // padding. Reading and editing them must preserve both words and pixels.
 const colo=await RomProject.create(original);colo.deleteTeam(21);colo.addTeam('COLO COLO');
 const crop=matrix=>{const xs=matrix.flatMap(row=>row.flatMap((pixel,x)=>pixel?[x]:[]));return matrix.map(row=>row.slice(Math.min(...xs),Math.max(...xs)+1));};
 const smallColo=teamNameTexts(original,colo.bytes(),21).small;
 for(const name of ['COLO COLO','COLOCOLO','COLO COLO','COLO  COLO','COLA  COLA','COLA COLA','COLA','COLO COLO']){
   colo.transaction(bigTeamNamePatches(original,colo.bytes(),21,name));
   assert.deepEqual(teamNameTexts(original,colo.bytes(),21),{small:smallColo,large:name});
   assert.deepEqual(crop(bigLabel(colo.bytes(),21).matrix),crop(previewBigTeamText(original,name).matrix));
   const reopenedColo=await RomProject.create(colo.exportRom());
   assert.equal(teamNameTexts(reopenedColo.original,reopenedColo.bytes(),21).large,name);
   assert.deepEqual(bigLabel(reopenedColo.bytes(),21).matrix,bigLabel(colo.bytes(),21).matrix);
 }
 for(let t=0;t<42;t++)if(t!==21)assert.deepEqual(bigLabel(colo.bytes(),t).matrix,bigLabel(original,t).matrix);
 assert.deepEqual((await RomProject.import(colo.record())).exportRom(),colo.exportRom());
 const unchanged=p.exportRom();for(const id of [-1,48,0.5])assert.throws(()=>p.deleteTeam(id),/Equipo inválido/);assert.deepEqual(p.exportRom(),unchanged);
 p.deleteTeam(0);let r=p.bytes();assert.equal(activeTeamIds(r).length,41);assert.equal(teamExists(r,0),false);assert.throws(()=>readDeluxeTeam(r,0));
 assert.ok(r.slice(loRom(0x87818e),loRom(0x87818e)+160).every(b=>b===255));assert.ok(r.slice(attributeOffset(r,0),attributeOffset(r,0)+140).every(b=>b===255));
 for(const [off,n,header] of erasedNativeResources(r))assert.ok(r.slice(off+header,off+n).every(b=>b===255));
 assert.ok(editableGroups(r).every(g=>!g.teams.includes(0)));assert.ok(readScenarios(r).every(s=>teamExists(r,s.playerTeam)&&teamExists(r,s.opponentTeam)));
 for(let i=0;i<6;i++)assert.deepEqual(readDeluxeTeam(r,36+i).players,stars[i]);assert.deepEqual(readStadiums(r),readStadiums(original));
 const erased=p.exportRom();p.undo();assert.deepEqual(p.exportRom(),original);p.redo();assert.deepEqual(p.exportRom(),erased);
 const imported=await RomProject.import(JSON.parse(JSON.stringify(p.record())));assert.deepEqual(imported.exportRom(),erased);
 const reopened=await RomProject.create(erased);assert.equal(activeTeamIds(reopened.bytes()).length,41);
 p.addTeam('CHILE');assert.equal(activeTeamIds(p.bytes()).length,42);assert.equal(teamExists(p.bytes(),0),true);assert.equal(teamNameTexts(original,p.bytes(),0).large,'CHILE');
 p.transaction(playerPatches(p.bytes(),0,0,{name:'Nuevo'}));assert.equal(readDeluxeTeam(p.bytes(),0).players[0].name,'Nuevo');assert.deepEqual(readDeluxeTeam(p.bytes(),36).players,stars[0]);
 const reused=await RomProject.create(p.exportRom());reused.deleteTeam(36);assert.ok(reused.bytes().slice(loRom(PHYSICAL_STAR_NAMES),loRom(PHYSICAL_STAR_NAMES)+160).every(b=>b===255));assert.equal(activeTeamIds(reused.bytes()).length,41);reused.addTeam('PERU');assert.equal(readDeluxeTeam(reused.bytes(),36).players[0].name,'Nuevo');
 // Deleting a middle added slot moves the entire following squad and visuals.
 const extra=await RomProject.create(original);for(const name of ['CHILE','PERU','BOLIVIA','ECUADOR','CANADA','CUBA'])extra.addTeam(name);
 extra.transaction(playerPatches(extra.bytes(),47,0,{name:'Ultimo',speed:2}));let flag=flagMatrix(extra.bytes(),47);flag[0][0]=12;extra.transaction(flagPatches(original,extra.bytes(),47,flag));
 const squads=Array.from({length:6},(_,i)=>readDeluxeTeam(extra.bytes(),42+i)),labels=Array.from({length:6},(_,i)=>bigLabel(extra.bytes(),42+i).matrix);
 extra.deleteTeam(44);r=extra.bytes();assert.equal(teamCount(r),47);assert.equal(activeTeamIds(r).length,47);
 for(let t=44;t<47;t++){const actual=readDeluxeTeam(r,t);assert.deepEqual(actual.players,squads[t-41].players);assert.deepEqual(actual.flag,squads[t-41].flag);assert.deepEqual(actual.colors,squads[t-41].colors);assert.deepEqual(bigLabel(r,t).matrix,labels[t-41]);}
 assert.equal(teamNameTexts(original,r,46).large,'CUBA');assert.ok(r.slice(loRom(0x87fac8)+5*160,loRom(0x87fac8)+6*160).every(b=>b===255));
 const compacted=extra.exportRom(),loaded=await RomProject.create(compacted);assert.equal(teamCount(loaded.bytes()),47);loaded.addTeam('CHINA');assert.equal(teamCount(loaded.bytes()),48);assert.equal(teamNameTexts(loaded.original,loaded.bytes(),47).large,'CHINA');assert.throws(()=>loaded.addTeam('OTRO'),/48/);
 for(let t=teamCount(extra.bytes())-1;t>=42;t--)extra.deleteTeam(t);assert.equal(teamCount(extra.bytes()),42);const emptyExtras=await RomProject.create(extra.exportRom());emptyExtras.addTeam('CHILE');assert.equal(teamCount(emptyExtras.bytes()),43);
 // At least one squad survives; native slots can all be cleared if an added
 // team remains. Every scenario is redirected to that live added team.
 const all=await RomProject.create(original);all.addTeam('CHILE');for(let t=0;t<42;t++)all.deleteTeam(t);
 assert.ok(all.bytes().slice(SHARED_BLANK_DETAIL,SHARED_BLANK_DETAIL+32).every(b=>b===0));
 assert.ok(!erasedNativeResources(all.bytes()).some(([offset])=>offset===SHARED_BLANK_DETAIL));
 const erasedBlankRecord=all.record();erasedBlankRecord.patches.push({id:`detail:${SHARED_BLANK_DETAIL}`,offset:SHARED_BLANK_DETAIL,bytes:Buffer.alloc(32,255).toString('base64')});
 assert.deepEqual((await RomProject.import(erasedBlankRecord)).exportRom(),all.exportRom());
 const erasedBlankRom=all.exportRom();erasedBlankRom.fill(255,SHARED_BLANK_DETAIL,SHARED_BLANK_DETAIL+32);
 const recovered=await RomProject.create(erasedBlankRom);assert.ok(recovered.bytes().slice(SHARED_BLANK_DETAIL,SHARED_BLANK_DETAIL+32).every(b=>b===0));recovered.exportRom();recovered.restore(`detail:${SHARED_BLANK_DETAIL}`);recovered.reset();assert.ok(recovered.bytes().slice(SHARED_BLANK_DETAIL,SHARED_BLANK_DETAIL+32).every(b=>b===0));recovered.exportRom();
 assert.throws(()=>all.transaction([{id:`detail:${SHARED_BLANK_DETAIL}`,offset:SHARED_BLANK_DETAIL,bytes:new Uint8Array(32).fill(1)}]),/tile transparente/);

 assert.deepEqual(activeTeamIds(all.bytes()),[42]);assert.ok(readScenarios(all.bytes()).every(s=>s.playerTeam===42&&s.opponentTeam===42));const last=all.exportRom();assert.throws(()=>all.deleteTeam(42),/al menos un equipo/);assert.deepEqual(all.exportRom(),last);
 for(const [table,n] of [[0x1027a,16],[0x102d0,16],[0x10326,11],[0x1037c,5],[0x103d2,1],[0xe7d8,4]]){const source=word(original,table+84);assert.equal(teamPointer(all.bytes(),table,48),source);if(source){const off=loRom(0x890000|source);assert.deepEqual(all.bytes().slice(off,off+2+n*2),original.slice(off,off+2+n*2));}}
 const onlyExtra=await RomProject.create(last);assert.deepEqual(activeTeamIds(onlyExtra.bytes()),[42]);onlyExtra.addTeam('PERU');assert.deepEqual(activeTeamIds(onlyExtra.bytes()),[0,42]);
 // A reused jersey detail occupies 32 bytes at the start of the legacy
 // 8192-byte atlas. Deleting its final owner must use the detail resource.
 const prueba=await RomProject.create(last);prueba.addTeam('PRUEB');prueba.addTeam('COLO COLO');prueba.deleteTeam(42);
 assert.deepEqual(activeTeamIds(prueba.bytes()),[0,21]);
 const beforePruebaDeletion=prueba.exportRom(),coloSquad=readDeluxeTeam(prueba.bytes(),21);
 prueba.deleteTeam(0);assert.deepEqual(activeTeamIds(prueba.bytes()),[21]);assert.deepEqual(readDeluxeTeam(prueba.bytes(),21),coloSquad);
 const detailOffset=loRom(0x980000|word(original,0xce8a));assert.equal(detailOffset,804308);
 assert.ok(prueba.bytes().slice(detailOffset,detailOffset+32).every(b=>b===255));
 const afterPruebaDeletion=prueba.exportRom();prueba.undo();assert.deepEqual(prueba.exportRom(),beforePruebaDeletion);prueba.redo();assert.deepEqual(prueba.exportRom(),afterPruebaDeletion);
 assert.deepEqual((await RomProject.import(prueba.record())).exportRom(),afterPruebaDeletion);
 assert.deepEqual(activeTeamIds((await RomProject.create(afterPruebaDeletion)).bytes()),[21]);
 prueba.addTeam('PRUEB');assert.deepEqual(activeTeamIds(prueba.bytes()),[0,21]);prueba.exportRom();
 // Choose a vacant frame by character AND sprite capacity, preserving the
 // two existing names when the first vacant frame cannot render CHILEED.
 const namesProject=await RomProject.create(last);namesProject.addTeam('PRUEB');namesProject.addTeam('HOLLAND');namesProject.deleteTeam(42);
 assert.deepEqual(activeTeamIds(namesProject.bytes()),[0,1]);
 assert.throws(()=>bigTeamNamePatches(namesProject.original,namesProject.bytes(),2,'CHILEED'),/requiere 11 sprites.*dispone de 8/);
 const prior=namesProject.exportRom(),priorLabels=[0,1].map(t=>bigLabel(namesProject.bytes(),t).matrix);
 namesProject.addTeam('chileed');const added=activeTeamIds(namesProject.bytes()).find(t=>t>1);
 assert.ok(added>2);assert.equal(teamExists(namesProject.bytes(),2),false);
 assert.equal(teamNameTexts(namesProject.original,namesProject.bytes(),added).large,'CHILEED');
 assert.equal(teamNameTexts(namesProject.original,namesProject.bytes(),added).small,'CHILEED');
 for(const [t,name] of ['PRUEB','HOLLAND'].entries()){assert.equal(teamNameTexts(namesProject.original,namesProject.bytes(),t).large,name);assert.deepEqual(bigLabel(namesProject.bytes(),t).matrix,priorLabels[t]);}
 const named=namesProject.exportRom();namesProject.undo();assert.deepEqual(namesProject.exportRom(),prior);namesProject.redo();assert.deepEqual(namesProject.exportRom(),named);
 const namesReopened=await RomProject.create(named);assert.equal(teamNameTexts(namesReopened.original,namesReopened.bytes(),added).large,'CHILEED');
 namesReopened.addTeam('CHILE');assert.equal(teamExists(namesReopened.bytes(),2),true);
 // If every vacant native frame is too small, use an available extra frame.
 const wider=await RomProject.create(original);wider.deleteTeam(0);wider.addTeam('HOLLAND');
 assert.equal(teamExists(wider.bytes(),0),false);assert.equal(teamNameTexts(wider.original,wider.bytes(),42).large,'HOLLAND');assert.equal(teamCount(wider.bytes()),43);wider.exportRom();
 // Reopened ROMs may already have relocated flags and small labels. Erase
 // their obsolete slot tails as well, while preserving the reusable font.
 const legacy=await RomProject.create(original);const oldFlag=flagMatrix(original,0);oldFlag[0][0]=12;legacy.transaction(flagPatches(original,legacy.bytes(),0,oldFlag));legacy.transaction(smallTeamNamePatches(original,legacy.bytes(),0,'CHILE'));
 const oldRom=legacy.exportRom(),oldLoaded=await RomProject.create(oldRom);oldLoaded.deleteTeam(0);const oldErased=await RomProject.create(oldLoaded.exportRom());oldErased.addTeam('PERU');assert.equal(teamNameTexts(oldErased.original,oldErased.bytes(),0).small,'PERU');
 const resetPlayer=playerOffsets(oldErased.bytes(),0,0);oldErased.transaction([...oldErased.restorePatches(`name:${resetPlayer.name}`),...oldErased.restorePatches(`attributes:${resetPlayer.attributes}`)]);assert.ok(readDeluxeTeam(oldErased.bytes(),0).players[0].name);
 const occupied=original.slice();occupied[loRom(0x8afd00)]=1;const blocked=await RomProject.create(occupied);assert.throws(()=>blocked.deleteTeam(0),/espacio.*ocupado/i);assert.deepEqual(blocked.exportRom(),occupied);assert.equal(blocked.canUndo,false);
 const header=new Uint8Array(original.length+512);header.fill(0x5a,0,512);header.set(original,512);const smc=await RomProject.create(header);smc.deleteTeam(22);assert.deepEqual(smc.exportRom().slice(0,512),header.slice(0,512));
 console.log('PASS physical teams: native/All-Star/extra erasure, shared resource preservation, compaction, slot reuse, all 42 removals, scenarios, stadium names, history, import/export, SMC header');
})().catch(e=>{console.error(e);process.exitCode=1;});
