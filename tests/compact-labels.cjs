const assert=require('node:assert/strict'),fs=require('node:fs');global.crypto ||= require('node:crypto').webcrypto;
(async()=>{
 const file='roms/International Superstar Soccer Deluxe (USA).sfc';if(!fs.existsSync(file)){console.log('SKIP compact labels: local USA ROM unavailable');return;}
 const {RomProject}=await import('../src/rom/project.mjs'),{compactTeamName,upgradeCompactTeamNamePatches,teamNameTexts}=await import('../src/rom/team-labels.mjs'),{smallLabelMatrix,smallLabelPatches}=await import('../src/rom/graphics.mjs');
 const original=new Uint8Array(fs.readFileSync(file)),legacy=compactTeamName(original,'I. MILAN',false),outlined=compactTeamName(original,'I. MILAN');
 assert.ok(outlined.flat().includes(3));for(let y=0;y<8;y++)for(let x=0;x<32;x++)assert.ok(outlined[y][x]===legacy[y][x]||legacy[y][x]===0&&outlined[y][x]===3,'Outline must preserve white/gray strokes');
 const p=await RomProject.create(original);p.transaction(smallLabelPatches(original,p.bytes(),0,legacy));const before=p.exportRom(),fixes=upgradeCompactTeamNamePatches(original,p.bytes());assert.ok(fixes.length);p.transaction(fixes);
 assert.deepEqual(smallLabelMatrix(p.bytes(),0),outlined);assert.equal(teamNameTexts(original,p.bytes(),0).small,'I. MILAN');assert.deepEqual(upgradeCompactTeamNamePatches(original,p.bytes()),[]);
 for(let team=1;team<42;team++)assert.deepEqual(smallLabelMatrix(p.bytes(),team),smallLabelMatrix(original,team));
 p.undo();assert.deepEqual(p.exportRom(),before);p.redo();assert.deepEqual((await RomProject.import(p.record())).exportRom(),p.exportRom());
 const custom=legacy.map(row=>row.slice());custom[0][0]=2;p.transaction(smallLabelPatches(original,p.bytes(),0,custom));assert.deepEqual(upgradeCompactTeamNamePatches(original,p.bytes()),[]);assert.deepEqual(smallLabelMatrix(p.bytes(),0),custom);
 console.log('PASS compact labels: black outlines, unchanged white/gray strokes, exact legacy raster upgrade, native/custom artwork preservation, decoding, history and project recovery');
})().catch(e=>{console.error(e);process.exitCode=1;});
