const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
global.crypto ||= require('node:crypto').webcrypto;
(async()=>{
 const file=process.env.ISSD_WC26_ROM||path.join(require('node:os').homedir(),'Downloads/ISSDWC26RC1GB2.0.sfc');
 if(!fs.existsSync(file)){console.log('SKIP WC26 data local ROM tests');return;}
 const rom=new Uint8Array(fs.readFileSync(file));
 const {RomProject}=await import('../src/rom/project.mjs');const {wc26TeamName,wc26TeamPresentation,wc26Groups,wc26LargeNames}=await import('../src/rom/wc26-data.mjs');
 const {wc26Graphics,wc26GraphicPatches,wc26SharedTeams}=await import('../src/rom/wc26-graphics.mjs');
 const {readDeluxeTeam}=await import('../src/rom/deluxe.mjs');const {readFormation}=await import('../src/rom/formations.mjs');const {playerPreviewFrames}=await import('../src/rom/player-preview.mjs');
 const {readScenarios,scenarioPatch}=await import('../src/rom/scenarios.mjs');const {readScenarioDescription}=await import('../src/rom/scenario-text.mjs');const {readScenarioSummary}=await import('../src/rom/scenario-summary.mjs');
 const {readStadiums,stadiumMeasurePatch}=await import('../src/rom/stadiums.mjs');const {mainMenuPreview,menuButtonLines}=await import('../src/rom/main-menu.mjs');const {MENU_SCREENS,readMenuText,menuTextPreview}=await import('../src/rom/menu-text.mjs');
 const {AUDIO_SAMPLES,readAudioSample}=await import('../src/rom/audio.mjs');const {createAudioPack,audioPackPatches}=await import('../src/rom/audio-pack.mjs');
 const names=Array.from({length:56},(_,i)=>wc26TeamName(rom,i));assert.equal(new Set(names).size,56);assert.equal(names[0],'SPAIN');assert.equal(names[30],'BRAZIL');assert.equal(names[48],'ITALY');assert.equal(names[55],'PERU');assert.equal(wc26LargeNames(rom).frames,58);
 for(let team=0;team<56;team++){
  const p=wc26TeamPresentation(rom,team);assert.equal(p.flag.length,16);assert.equal(p.flag[0].length,24);assert.ok([8,16].includes(p.teamMatrix.length));assert.equal(p.bigLabel.matrix.length,24);assert.ok(p.bigLabel.matrix.flat().some(Boolean));assert.equal(p.kits.home.colors.length,16);assert.equal(p.kits.away.colors.length,16);assert.equal(p.kits.goalkeeper.colors.length,11);
  const f=readFormation(rom,team);assert.equal(f.slots.length,10);assert.ok(f.slots.every(s=>[1,2,3,5,6].includes(s.role)));
  for(const player of readDeluxeTeam(rom,team).players)assert.equal(playerPreviewFrames(rom,team,player).length,8);
 }
 const groups=wc26Groups(rom);assert.equal(groups.length,14);assert.equal(groups.filter(g=>g.tournament).length,12);assert.equal(new Set(groups.flatMap(g=>g.teams)).size,56);assert.deepEqual(groups[0].teams,[9,36,3,21]);
 assert.equal(readScenarios(rom).length,12);for(let i=0;i<12;i++){assert.ok(!readScenarioDescription(rom,i).text.includes('�'));assert.ok(!readScenarioSummary(rom,i).lines.join('').includes('�'));}
 assert.equal(readStadiums(rom).length,8);assert.equal(mainMenuPreview(rom).matrix.length,224);for(let i=0;i<8;i++)assert.ok(menuButtonLines(rom,i).some(Boolean));
 for(const screen of MENU_SCREENS)for(const field of screen.fields){assert.ok(readMenuText(rom,screen.id,field.key));assert.ok(menuTextPreview(rom,screen.id,field.key).matrix.length);}
 for(const sample of AUDIO_SAMPLES)assert.ok(readAudioSample(rom,sample).length);
 const project=await RomProject.create(rom);project.transaction(audioPackPatches(rom,createAudioPack(rom)));assert.equal(project.patches.length,0);
 const flag=wc26Graphics(rom,0)[0];assert.ok(wc26SharedTeams(rom,flag).includes(0));
 project.transaction(wc26GraphicPatches(rom,flag,flag.matrix.map(row=>row.map(()=>0))));assert.ok(wc26TeamPresentation(project.bytes(),0).flag.flat().every(p=>p===0));project.undo();assert.deepEqual(project.exportRom(),rom);
 const formation=readFormation(rom,0),other=readFormation(rom,1);project.transaction([{...formation,bytes:other.bytes.slice()}]);assert.deepEqual(readFormation(project.bytes(),0).bytes,other.bytes);project.undo();assert.deepEqual(project.exportRom(),rom);
 const scenario=readScenarios(rom)[0];project.transaction([scenarioPatch(rom,0,{playerTeam:55})]);assert.ok(readScenarioSummary(project.bytes(),0).lines[0].includes('PERU'));project.undo();assert.deepEqual(project.exportRom(),rom);
 const stadium=readStadiums(rom)[0];project.transaction([stadiumMeasurePatch(0,'yards',stadium.lengthYards===114?115:114,stadium.widthYards)]);assert.notEqual(readStadiums(project.bytes())[0].lengthYards,stadium.lengthYards);assert.equal((await RomProject.import(project.record(),rom)).exportRom().length,rom.length);project.undo();assert.deepEqual(project.exportRom(),rom);
 console.log('PASS WC26 data: 56 names/flags/labels/palettes/formations, 1120 eight-view players, 14 groups, 12 scenarios, 8 stadiums, all menu fields and 76 audio samples; native graphic/form/scenario/stadium mutations and undo');
})();
