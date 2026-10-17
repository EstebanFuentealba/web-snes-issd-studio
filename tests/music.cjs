const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
global.crypto ||=require('node:crypto').webcrypto;
(async()=>{
 const {compileMusic,decodeMusic,editMusicNote,musicResources,readMusic,musicPatch}=await import('../src/rom/music.mjs'),{writeMidi,readMidi}=await import('../src/rom/music-midi.mjs'),{writeSpc,readSpc}=await import('../src/rom/music-spc.mjs'),{RomProject}=await import('../src/rom/project.mjs');
 const song={tempo:100,tracks:[{instrument:1,notes:[{tick:0,duration:24,pitch:48,velocity:100},{tick:48,duration:12,pitch:60,velocity:80}]}]},bytes=compileMusic(song,6),decoded=decodeMusic(bytes);
 assert.equal(decoded.tracks.length,6);assert.deepEqual(decoded.tracks[0].notes.map(n=>[n.tick,n.pitch,n.duration]),[[0,48,24],[48,60,12]]);
 const midi=writeMidi(decoded),imported=readMidi(midi);assert.equal(midi[26]*65536+midi[27]*256+midi[28],983040,'MIDI must use the real 125 Hz driver clock');assert.equal(imported.tempo,song.tempo);assert.equal(imported.tracks.length,1);assert.deepEqual(imported.tracks[0].notes.map(n=>[n.tick,n.pitch,n.duration]),[[0,48,24],[48,60,12]]);assert.equal(imported.tracks[0].instrument,1);
 assert.throws(()=>readMidi(midi.slice(0,-1)));assert.throws(()=>readMidi(Uint8Array.of(1,2,3)));assert.throws(()=>compileMusic({...song,tracks:[{instrument:1,notes:[song.tracks[0].notes[0],{tick:1,duration:12,pitch:60,velocity:80}]}]},6),/simultánea/);
 assert.throws(()=>compileMusic({...song,tracks:new Array(7).fill(song.tracks[0])},6),/canales/);assert.throws(()=>decodeMusic(Uint8Array.of(255,255,255)));
 const file=path.join(__dirname,'../roms/International Superstar Soccer Deluxe (USA).sfc');if(!fs.existsSync(file)){console.log('SKIP music ROM integration: local USA ROM missing');return;}
 const input=fs.readFileSync(file),p=await RomProject.create(input),resources=musicResources(p.bytes()),main=resources.find(r=>r.name==='MainMenu'),native=readMusic(p.bytes(),main),note=native.tracks[0].notes.find(n=>!n.percussion),edited=editMusicNote(native.bytes,note,{pitch:note.pitch+1}),patch=musicPatch(p.bytes(),main,edited);
 assert.throws(()=>musicPatch(p.bytes(),main,compileMusic(song,5)),/canales/);
 p.transaction([patch]);const current=p.bytes();assert.deepEqual(readMusic(current,main).bytes,edited);assert.deepEqual(current.slice(0,main.offset),p.original.slice(0,main.offset));assert.deepEqual(current.slice(main.offset+main.capacity),p.original.slice(main.offset+main.capacity));
 p.undo();assert.deepEqual(p.exportRom(),new Uint8Array(input));p.redo();const q=await RomProject.import(p.record({includeOriginal:true}));assert.deepEqual(q.bytes(),p.bytes());const reopened=await RomProject.create(p.exportRom());assert.deepEqual(readMusic(reopened.bytes(),main).bytes,edited);
 const spc=writeSpc(p.bytes(),main,edited);assert.deepEqual(readSpc(spc,p.bytes(),main),edited);const bad=spc.slice();bad[0x100+0x13ff]^=1;assert.throws(()=>readSpc(bad,p.bytes(),main),/driver/);assert.throws(()=>readSpc(spc.slice(0,100),p.bytes(),main));
 const overflow=patch.bytes.slice();overflow[0]=255;overflow[1]=127;assert.throws(()=>p.transaction([{...patch,bytes:overflow}]));assert.deepEqual(p.bytes(),q.bytes());
 p.restore(main.id);assert.deepEqual(p.exportRom(),new Uint8Array(input));
 const header=new Uint8Array(input.length+512);header.fill(73,0,512);header.set(input,512);const h=await RomProject.create(header);h.transaction([musicPatch(h.bytes(),main,bytes)]);const exported=h.exportRom();assert.deepEqual(exported.slice(0,512),header.slice(0,512));assert.equal(exported.length,header.length);
 assert.equal(musicResources(new Uint8Array(0x200000)).length,0);
 console.log('PASS music: native note edits, MIDI/SPC exchange, malformed inputs, polyphony/capacity limits, project recovery, undo/redo, restore and copier header');
})().catch(e=>{console.error(e);process.exitCode=1;});
