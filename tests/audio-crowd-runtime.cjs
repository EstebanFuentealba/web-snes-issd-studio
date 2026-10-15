const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
global.crypto ||= require('node:crypto').webcrypto;
function state(file){
 const bytes=fs.readFileSync(file),index=bytes.indexOf(Buffer.from('SND:'));assert.ok(index>=0,'Snes9x must provide its SND state');
 const size=Number(bytes.subarray(index+4,index+10).toString()),snd=bytes.subarray(index+11,index+11+size);assert.ok(snd.length>65700);
 return {aram:snd.subarray(0,65536),dsp:snd.subarray(65536+164,65536+164+128)};
}
module.exports=async function crowdRuntime(core){
 const {RomProject}=await import('../src/rom/project.mjs'),{audioRegion,replacementAudio,parseWav}=await import('../src/rom/audio-edit.mjs'),{AUDIO_SAMPLES,readAudioSample}=await import('../src/rom/audio.mjs'),{LONG_AUDIO,ANNOUNCER_NAMES}=await import('../src/rom/audio-long.mjs'),{decompress,word}=await import('../src/rom/binary.mjs'),{compress}=await import('../src/rom/graphics.mjs');
 const original=fs.readFileSync(path.join(__dirname,'../roms/International Superstar Soccer Deluxe (USA).sfc')),directory=fs.mkdtempSync(path.join(os.tmpdir(),'issd-crowd-runtime-'));
 const wavPath=process.env.ISSD_CROWD_WAV||process.env.ISSD_LONG_AUDIO_WAV||'';let wav;
 if(fs.existsSync(wavPath)){const f=fs.readFileSync(wavPath);wav=parseWav(f.buffer.slice(f.byteOffset,f.byteOffset+f.length));}else wav={samples:Int16Array.from({length:48000},(_,i)=>Math.round(10000*Math.sin(i*2*Math.PI*700/16000))),sampleRate:16000};
 const sample=AUDIO_SAMPLES.find(s=>s.name==='NiceDummy1'),project=await RomProject.create(original),replacement=replacementAudio(project.bytes(),sample,wav,1300,true);project.transaction(replacement.patches);
 const safe=project.exportRom(),unsafe=safe.slice(),meta=unsafe.subarray(LONG_AUDIO.metadata,LONG_AUDIO.metadata+LONG_AUDIO.metadataSize),region=audioRegion(safe,sample),bank=LONG_AUDIO.pool+region.slot*LONG_AUDIO.slotSize;
 // Exact earlier format: full BRR copied into $4900 and only gates extended.
 meta[7]=0;unsafe.fill(255,bank,bank+LONG_AUDIO.slotSize);const length=Math.floor((region.bytes.length+2)/3);unsafe[bank]=length&255;unsafe[bank+1]=length>>>8;unsafe.set(region.bytes,bank+2);
 const legacy=decompress(unsafe,0x1e8000);ANNOUNCER_NAMES.forEach((name,i)=>{const s=AUDIO_SAMPLES.find(s=>s.name===name);if(meta[8+AUDIO_SAMPLES.indexOf(s)*3]!==255){const p=word(legacy,0x52c+i*2)-0x200;if(legacy[p]===0xee)legacy[p+3]=255;}});
 unsafe.fill(255,LONG_AUDIO.driver,LONG_AUDIO.driver+LONG_AUDIO.driverSize);unsafe.set(compress(legacy),LONG_AUDIO.driver);
 const fixtures=[['stock',original],['unsafe',unsafe],['safe',safe]];let user;
 if(process.env.ISSD_AUDIO_PROJECT){const record=JSON.parse(fs.readFileSync(process.env.ISSD_AUDIO_PROJECT,'utf8'));user=await RomProject.import(record,original);fixtures.push(['user',user.exportRom()]);
  const old=user.exportRom();for(const p of record.patches)old.set(Buffer.from(p.bytes,'base64'),p.offset);fixtures.push(['user-unsafe',old]);
  const migrated=new Map(user.patches.map(p=>[p.id,p]));for(const p of record.patches)if(!p.id.startsWith('audio-long:'))assert.deepEqual(migrated.get(p.id)?.bytes,new Uint8Array(Buffer.from(p.bytes,'base64')),`Keep project edit ${p.id}`);
  for(const s of AUDIO_SAMPLES)if(audioRegion(old,s).extended)assert.deepEqual(audioRegion(user.bytes(),s).bytes,audioRegion(old,s).bytes,`Archive edited long ${s.name} without loss`);
  for(const s of AUDIO_SAMPLES){const native=record.patches.find(p=>p.id===`audio:${audioRegion(original,s).nativeOffset}`);if(!audioRegion(user.bytes(),s).extended&&native)assert.deepEqual(audioRegion(user.bytes(),s).bytes,new Uint8Array(Buffer.from(native.bytes,'base64')),`Keep edited ${s.name}`);}
 }
 const frames=[10700,11100,11400,11450,11550,11750,11950,12150,12550],results=new Map(),input=[[400,20,3],[600,20,3],[800,20,3],[3300,10,8],[3500,10,8],[3800,10,8],[4300,10,3],[4500,10,8],[4800,10,8],[5800,10,3],[6100,10,8],[8000,10,8],[8300,10,8],[8600,10,8],[9000,10,3]],writes=[[10800,0x1d2e,[18,0]],[11200,0x1d2e,[29,0]],[11400,0x1d2e,[29,0]],[11600,0x1d2e,[8,0]],[12000,0x1d2e,[18,0]],[12400,0x1d2e,[8,0]]];
 for(const [name,bytes] of fixtures){const rom=path.join(directory,name+'.sfc'),output=path.join(directory,name);fs.writeFileSync(rom,bytes);const run=spawnSync(process.env.PYTHON||'python3',[path.join(__dirname,'snes9x-headless.py'),path.resolve(core),rom,output],{encoding:'utf8',timeout:90000,env:{...process.env,ISSD_FRAMES:'12800',ISSD_INPUT:JSON.stringify(input),ISSD_WRAM_WRITES:JSON.stringify(writes),ISSD_CAPTURE_AUDIO:'1',ISSD_STATE_FRAMES:JSON.stringify(frames)}});assert.equal(run.status,0,run.stderr);results.set(name,frames.map(frame=>({frame,...state(output+'.'+frame+'.state')})));}
 const protectedStart=0x6900,protectedEnd=0xa66b,baseline=results.get('stock')[0].aram.subarray(protectedStart,protectedEnd);
 assert.ok(results.get('unsafe').some(s=>!s.aram.subarray(protectedStart,protectedEnd).equals(baseline)),'Legacy long audio must reproduce overwritten resident samples');
 assert.ok(results.get('unsafe').some(s=>s.dsp[0x38]===0&&s.dsp[0x48]===0),'Legacy long audio must reproduce silent background channels');
 const measurements=[];
 for(const name of ['safe',...(user?['user']:[])]){
  const snapshots=results.get(name);for(const s of snapshots){assert.deepEqual(s.aram.subarray(protectedStart,protectedEnd),baseline,`${name}: preserve every resident byte after frame ${s.frame}`);assert.ok(s.dsp[0x38]>0&&s.dsp[0x48]>0,`${name}: crowd channels must still be sounding at frame ${s.frame}`);}
  const repeat=snapshots.find(s=>s.frame===11450);assert.ok(repeat.dsp[0x58]>0,'Repeating the same long voice must retrigger playback without waiting for a nonexistent transfer');
  const rom=fixtures.find(f=>f[0]===name)[1];for(const [frame,voice] of [[11750,'HalfTime'],[12150,'GoodTouch'],[12550,'HalfTime']]){const s=snapshots.find(s=>s.frame===frame),r=audioRegion(rom,AUDIO_SAMPLES.find(s=>s.name===voice)),src=r.extended?0x3800:0x4900,expected=rom.subarray(r.extended?r.playbackOffset:r.offset,(r.extended?r.playbackOffset:r.offset)+(r.extended?r.playbackCapacity:r.capacity));assert.deepEqual(s.aram.subarray(src,src+expected.length),Buffer.from(expected),`${name}: ${voice} must contain its own edited BRR at frame ${frame}`);}
  measurements.push({fixture:name,crowdActive:snapshots.map(s=>({frame:s.frame,channels:[s.dsp[0x38],s.dsp[0x48]]})),residentBytesPreserved:protectedEnd-protectedStart,halfTimeChecked:[11750,12550]});
 }
 // Enter actual play, then expire the match clock while NiceDummy1 is still
 // active. The game itself must request HalfTime and reach its results screen.
 if(user){
  const output=path.join(directory,'user-halftime'),rom=path.join(directory,'user.sfc'),halfFrames=[14950,15400,15600,16000];
  const run=spawnSync(process.env.PYTHON||'python3',[path.join(__dirname,'snes9x-headless.py'),path.resolve(core),rom,output],{encoding:'utf8',timeout:90000,env:{...process.env,ISSD_FRAMES:'18000',ISSD_INPUT:JSON.stringify([...input,[13000,10,8],[13300,10,8],[13600,10,8],[13800,10,8]]),ISSD_WRAM_WRITES:JSON.stringify([[15000,0x1d2e,[29,0]],[15060,0x16d0,[0,0,0,0]],[15060,0x16d8,[1,0]]]),ISSD_CAPTURE_AUDIO:'1',ISSD_STATE_FRAMES:JSON.stringify(halfFrames)}});assert.equal(run.status,0,run.stderr);
  const halftimeState=fs.readFileSync(output+'.16000.state'),ramIndex=halftimeState.indexOf(Buffer.from('RAM:'))+11,ram=halftimeState.subarray(ramIndex,ramIndex+131072);assert.equal(ram.readUInt16LE(0x1d08),8,'Native period end must request HalfTime, not GoodTouch');
  const half=state(output+'.16000.state'),r=audioRegion(user.bytes(),AUDIO_SAMPLES.find(s=>s.name==='HalfTime'));assert.deepEqual(half.aram.subarray(0x4900,0x4900+r.capacity),Buffer.from(r.bytes),'The native halftime event must play the supplied HalfTime edit');
  const finalRam=fs.readFileSync(output+'.ram');assert.equal(finalRam.readUInt16LE(0x70),0x12,'The native halftime results screen must be reached');
  measurements.push({fixture:'native halftime',voiceId:8,resultsMode:0x12});
 }
 fs.writeFileSync(path.join(directory,'measurements.json'),JSON.stringify({wav:fs.existsSync(wavPath)?path.basename(wavPath):'synthetic',measurements},null,2));
 console.log(`PASS crowd runtime: legacy overwrite reproduced, edited NiceDummy1, resident samples/crowd preserved, HalfTime -> GoodTouch -> HalfTime identities${user?', supplied project preserved':''}. Evidence: ${directory}`);
 return directory;
};
if(require.main===module)module.exports(process.env.SNES9X_CORE).catch(e=>{console.error(e);process.exitCode=1;});
