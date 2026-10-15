const assert=require('node:assert/strict'),fs=require('node:fs');
global.crypto ||= require('node:crypto').webcrypto;
(async()=>{
 const {RomProject}=await import('../src/rom/project.mjs'),{announcerReverbPatches,announcerReverbDisabled,supportsAnnouncerReverb}=await import('../src/rom/audio-reverb.mjs');
 const {replacementAudio}=await import('../src/rom/audio-edit.mjs'),{AUDIO_SAMPLES}=await import('../src/rom/audio.mjs'),{decompress}=await import('../src/rom/binary.mjs'),{LONG_AUDIO,validateLongAudio}=await import('../src/rom/audio-long.mjs'),{decodeBrr}=await import('../src/rom/audio.mjs');
 const original=new Uint8Array(fs.readFileSync('roms/International Superstar Soccer Deluxe (USA).sfc')),p=await RomProject.create(original);
 assert.ok(supportsAnnouncerReverb(original));assert.equal(announcerReverbDisabled(original),false);
 const toggle=value=>p.transaction(announcerReverbPatches(p.original,p.bytes(),value));
 toggle(true);const dry=p.exportRom();assert.ok(announcerReverbDisabled(dry));
 assert.deepEqual((await RomProject.import(p.record())).exportRom(),dry);
 p.undo();assert.deepEqual(p.exportRom(),original);p.redo();assert.deepEqual(p.exportRom(),dry);
 toggle(false);assert.deepEqual(p.exportRom(),original);assert.equal(p.patches.length,0);
 toggle(true);const forged=p.patches;forged[0].bytes[4]^=1;assert.throws(()=>p.transaction(forged));assert.deepEqual(p.exportRom(),dry);
 // A ROM opened with the setting already enabled can still turn it off.
 const imported=await RomProject.create(dry);imported.transaction(announcerReverbPatches(imported.original,imported.bytes(),false));assert.equal(announcerReverbDisabled(imported.exportRom()),false);
 // Both edit orders must generate the same active SPC driver.
 const sample=AUDIO_SAMPLES.find(s=>s.name==='PastThePost2'),wav={samples:Int16Array.from({length:24000},(_,i)=>Math.round(8000*Math.sin(i/4))),sampleRate:12000};
 const addLong=project=>{const edit=replacementAudio(project.bytes(),sample,wav,1300,true);project.transaction(edit.patches);};
 addLong(p);assert.ok(announcerReverbDisabled(p.exportRom()));validateLongAudio(p.bytes(),decodeBrr);
 const q=await RomProject.create(original);addLong(q);q.transaction(announcerReverbPatches(q.original,q.bytes(),true));assert.deepEqual(q.exportRom(),p.exportRom());
 const audioBefore=q.patches.filter(p=>p.id.startsWith('audio-long:slot:'));
 q.transaction(announcerReverbPatches(q.original,q.bytes(),false));assert.equal(announcerReverbDisabled(q.exportRom()),false);validateLongAudio(q.bytes(),decodeBrr);
 assert.deepEqual(q.patches.filter(p=>p.id.startsWith('audio-long:slot:')),audioBefore);
 assert.equal(decompress(q.bytes(),LONG_AUDIO.driver)[0x19a2-0x200],0x08);
  assert.deepEqual((await RomProject.import(q.record())).exportRom(),q.exportRom());
 q.transaction(announcerReverbPatches(q.original,q.bytes(),true));q.restore('audio-reverb:driver');
 assert.equal(announcerReverbDisabled(q.exportRom()),false);validateLongAudio(q.bytes(),decodeBrr);
 assert.deepEqual(q.patches.filter(p=>p.id.startsWith('audio-long:slot:')),audioBefore);
 const component=fs.readFileSync('src/components/StudioEditor.vue','utf8');assert.match(component,/:checked="reverbDisabled" @change="setAnnouncerReverb\(\$event.target.checked\)"/);
 console.log('PASS commentary reverb: reversible ROM setting, history, project roundtrip, tamper rejection, imported dry ROM and long audio in both edit orders');
})().catch(e=>{console.error(e);process.exitCode=1;});
