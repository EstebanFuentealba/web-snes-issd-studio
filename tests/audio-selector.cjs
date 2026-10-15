const assert=require('node:assert/strict'),fs=require('node:fs');
global.crypto ||= require('node:crypto').webcrypto;
(async()=>{
 const {RomProject}=await import('../src/rom/project.mjs'),{AUDIO_SAMPLES}=await import('../src/rom/audio.mjs'),{audioSelectorStatus,audioSelectorLabel}=await import('../src/rom/audio-selector.mjs'),{replacementAudio,pitchRate}=await import('../src/rom/audio-edit.mjs'),{loRom}=await import('../src/rom/binary.mjs');
 const input=new Uint8Array(fs.readFileSync('roms/International Superstar Soccer Deluxe (USA).sfc')),project=await RomProject.create(input),sample=AUDIO_SAMPLES.find(s=>s.name==='PastThePost2');
 const original=project.exportRom();
 assert.deepEqual(audioSelectorStatus(project.bytes(),sample),{time:'Dentro del tiempo',lowQuality:false});
 project.setAudioTitle(sample.name,'  Mi relato / final  ');assert.equal(project.audioTitle(sample.name),'Mi relato / final');
 assert.deepEqual(project.exportRom(),original,'Titles must never change ROM bytes');
 project.undo();assert.equal(project.audioTitle(sample.name),'');project.redo();assert.equal(project.audioTitle(sample.name),'Mi relato / final');
 let restored=await RomProject.import(project.record());assert.equal(restored.audioTitle(sample.name),'Mi relato / final');
 assert.throws(()=>project.setAudioTitle('invalid','test'));assert.throws(()=>project.setAudioTitle(sample.name,'x'.repeat(121)));
 await assert.rejects(()=>RomProject.import({...project.record(),audioTitles:[]}));
 await assert.rejects(()=>RomProject.import({...project.record(),audioTitles:{invalid:'test'}}));
 const native=Math.floor((loRom(sample.end)-loRom(sample.start))/9)*16;
 for(const [ratio,time,lowQuality] of [[1.05,'Se pasa un poco',false],[1.3,'Supera el tiempo',false],[2.5,'Supera el tiempo',true]]){
  const wav={samples:new Int16Array(Math.round(native*ratio)),sampleRate:pitchRate(1300)};
  project.transaction(replacementAudio(project.bytes(),sample,wav,1300,true).patches);
  assert.deepEqual(audioSelectorStatus(project.bytes(),sample),{time,lowQuality});
  assert.equal(project.audioTitle(sample.name),'Mi relato / final','Audio changes preserve titles');
 }
 restored=await RomProject.import(project.record());assert.equal(restored.audioTitle(sample.name),'Mi relato / final');
 assert.deepEqual(audioSelectorStatus(restored.bytes(),sample),{time:'Supera el tiempo',lowQuality:true});
 assert.equal(audioSelectorLabel(sample,'Final',audioSelectorStatus(restored.bytes(),sample)),'PastThePost2 / Final / Supera el tiempo · Calidad reducida');
 assert.equal(audioSelectorLabel(sample,'',{time:'Dentro del tiempo',lowQuality:false}),'PastThePost2 / Sin título / Dentro del tiempo');
 project.setAudioTitle(sample.name,'');assert.equal(project.audioTitle(sample.name),'');project.undo();assert.equal(project.audioTitle(sample.name),'Mi relato / final');
 project.reset();assert.equal(project.audioTitle(sample.name),'');project.undo();assert.equal(project.audioTitle(sample.name),'Mi relato / final');
 console.log('PASS audio selector: duration boundaries, reduced playback quality, titles persist through audio edits, project import, undo/redo and reset without changing ROM bytes');
})().catch(e=>{console.error(e);process.exitCode=1;});
