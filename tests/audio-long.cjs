const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
global.crypto ||= require('node:crypto').webcrypto;
(async()=>{
 const {RomProject}=await import('../src/rom/project.mjs'),{AUDIO_SAMPLES,readAudioSample}=await import('../src/rom/audio.mjs'),{audioRegion,replacementAudio,normalizedAudioPatches}=await import('../src/rom/audio-edit.mjs'),{LONG_AUDIO,restoreLongAudioPatches}=await import('../src/rom/audio-long.mjs'),{createAudioPack,audioPackPatches}=await import('../src/rom/audio-pack.mjs');
 const input=new Uint8Array(fs.readFileSync(path.join(__dirname,'../roms/International Superstar Soccer Deluxe (USA).sfc'))),sample=AUDIO_SAMPLES.find(s=>s.name==='PastThePost2');
 const wav={samples:Int16Array.from({length:48000},(_,i)=>Math.round(12000*Math.sin(i/12))),sampleRate:24000},project=await RomProject.create(input);
 assert.throws(()=>replacementAudio(project.bytes(),sample,wav,1300),/Duración máxima/);
 const replacement=replacementAudio(project.bytes(),sample,wav,1300,true);assert.ok(replacement.patches);project.transaction(replacement.patches);
 const changed=project.exportRom(),region=audioRegion(project.bytes(),sample);assert.equal(changed.length,0x400000);assert.ok(region.extended);assert.ok(region.capacity>5445);
 for(const s of AUDIO_SAMPLES.filter(s=>s.name!==sample.name))assert.deepEqual(audioRegion(project.bytes(),s).bytes,audioRegion(input,s).bytes,`Preserve ${s.name}`);
 assert.equal(readAudioSample(project.bytes(),sample).length,region.capacity/9*16);
 const restored=await RomProject.import(project.record());assert.deepEqual(restored.exportRom(),changed);
 project.undo();assert.deepEqual(project.bytes(),new Uint8Array(input));project.redo();assert.deepEqual(project.exportRom(),changed);
 const reopened=await RomProject.create(changed);assert.equal(audioRegion(reopened.bytes(),sample).capacity,region.capacity);
 const pack=createAudioPack(changed);assert.equal(pack.version,2);const receiving=await RomProject.create(input);receiving.transaction(audioPackPatches(receiving.bytes(),pack));assert.deepEqual(receiving.exportRom(),changed);
 receiving.transaction(audioPackPatches(receiving.bytes(),createAudioPack(input)));assert.deepEqual(audioRegion(receiving.bytes(),sample).bytes,audioRegion(input,sample).bytes);assert.equal(audioRegion(receiving.bytes(),sample).extended,false);
 project.transaction(normalizedAudioPatches(project.bytes(),project.patches));assert.ok(audioRegion(project.bytes(),sample).extended);
 const neighbor=AUDIO_SAMPLES.find(s=>s.name==='LongBall2'),second=replacementAudio(project.bytes(),neighbor,wav,1300,true);project.transaction(second.patches);assert.notEqual(audioRegion(project.bytes(),neighbor).slot,region.slot);
 const bad=replacement.patches.find(p=>p.id.startsWith('audio-long:pointer:'));assert.throws(()=>project.transaction([{...bad,bytes:Uint8Array.of(0,0,0)}]),/Puntero/);
 assert.throws(()=>replacementAudio(project.bytes(),sample,{samples:new Int16Array(200000),sampleRate:24000},1300,true),/Duración máxima/);
 project.transaction(restoreLongAudioPatches(project.original,project.bytes(),sample));assert.equal(audioRegion(project.bytes(),sample).extended,false);assert.ok(audioRegion(project.bytes(),neighbor).extended);
 project.addTeam('TEST');assert.ok(audioRegion(project.bytes(),neighbor).extended);assert.equal(project.bytes().length,0x400000);
 assert.ok(LONG_AUDIO.capacity%9===0);
 // Native 2 MiB projects with deleted squads cannot pass the generic hack
 // reader's 42-team table checks when audio alone expands them to 4 MiB.
 const sparse=await RomProject.create(input);sparse.createEmptyRom();sparse.addTeam('KEEP');
 const {playerPatches}=await import('../src/rom/players.mjs'),{readDeluxeTeam}=await import('../src/rom/deluxe.mjs'),{openRom}=await import('../src/rom/binary.mjs');
 sparse.transaction(playerPatches(sparse.bytes(),0,0,{name:'KEEPTEST'}));
 const sparseAudio=replacementAudio(sparse.bytes(),sample,wav,1300,true);sparse.transaction(sparseAudio.patches);
 const sparseExport=sparse.exportRom();assert.equal(openRom(sparseExport).game,'issd');
 const sparseRecovered=await RomProject.import(sparse.record());assert.deepEqual(sparseRecovered.exportRom(),sparseExport);
 const sparseReopened=await RomProject.create(sparseExport);assert.equal(readDeluxeTeam(sparseReopened.bytes(),0).players[0].name,'KEEPTEST');
 assert.deepEqual(audioRegion(sparseReopened.bytes(),sample).bytes,audioRegion(sparse.bytes(),sample).bytes);
 const smc=new Uint8Array(sparseExport.length+512);smc.set(sparseExport,512);assert.equal(openRom(smc).headerSize,512);
 const wrongRegion=sparseExport.slice();wrongRegion[0x7fd9]=2;assert.throws(()=>openRom(wrongRegion),/compatible/);
 console.log('PASS long audio: relocation, neighboring voices, capacity limits, malformed pointers, native/v2 packs, project recovery, reopening, undo/redo, normalization, restoration and expanded-team composition');
})().catch(e=>{console.error(e);process.exitCode=1;});
