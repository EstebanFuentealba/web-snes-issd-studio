const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
global.crypto ||= require('node:crypto').webcrypto;
module.exports=async function audioLongRuntime(core){
 const {RomProject}=await import('../src/rom/project.mjs'),{AUDIO_SAMPLES}=await import('../src/rom/audio.mjs'),{replacementAudio,pitchRate,parseWav}=await import('../src/rom/audio-edit.mjs');
 const source=fs.readFileSync(path.join(__dirname,'../roms/International Superstar Soccer Deluxe (USA).sfc')),sample=AUDIO_SAMPLES.find(s=>s.name==='PastThePost2'),rate=pitchRate(1300),directory=fs.mkdtempSync(path.join(os.tmpdir(),'issd-long-audio-runtime-'));
 const tone=seconds=>({samples:Int16Array.from({length:Math.floor(rate*seconds)},(_,i)=>Math.round(12000*Math.sin(2*Math.PI*700*i/rate))),sampleRate:rate});
 const fixtures=[['silent',{samples:new Int16Array(Math.floor(rate*1.9)),sampleRate:rate},true],['short-silence',{samples:new Int16Array(Math.floor(rate*.9)),sampleRate:rate},false],['short',tone(.9),false],['long',tone(1.9),true],['toggle',tone(.95),true,source,true],['wide',tone(3),true],['wide-silence',{samples:new Int16Array(Math.floor(rate*3)),sampleRate:rate},true]];
 if(process.env.ISSD_LONG_AUDIO_WAV){const input=fs.readFileSync(process.env.ISSD_LONG_AUDIO_WAV);const wav=parseWav(input.buffer.slice(input.byteOffset,input.byteOffset+input.byteLength));fixtures.push(['user-silence',{samples:new Int16Array(wav.samples.length),sampleRate:wav.sampleRate},true],['user-wav',wav,true]);}
 const sparse=await RomProject.create(source);sparse.createEmptyRom();sparse.addTeam('KEEP');
 const {playerPatches}=await import('../src/rom/players.mjs');sparse.transaction(playerPatches(sparse.bytes(),0,0,{name:'KEEPTEST'}));
 const sparseSource=sparse.exportRom();fixtures.push(['sparse-silence',{samples:new Int16Array(Math.floor(rate*1.9)),sampleRate:rate},true,sparseSource],['sparse',tone(1.9),true,sparseSource]);
 const recordings=new Map();
 for(const [name,wav,long,base=source,viaToggle=false] of fixtures){
  const project=await RomProject.create(base);let replacement;
  if(viaToggle){
   const range={start:0,end:wav.samples.length/wav.sampleRate,stretch:2},editor=await require('./audio-length-harness.cjs')({rom:project.bytes(),sample,wav,range});
   editor.prepareAudioTrim(range);assert.equal(editor.audioReplacement,null,'Expanded clip must exceed the native allocation');
   editor.audioLong=true;await editor.changeAudioLength();replacement=editor.audioReplacement;
   assert.ok(replacement?.patches,'Checkbox alone must prepare the long preview/export');assert.ok(editor.audioUrl);assert.deepEqual(editor.audioRange,range);
  }else replacement=replacementAudio(project.bytes(),sample,wav,1300,long);
  project.transaction(replacement.patches||[replacement.patch]);
  const file=path.join(directory,name+'.sfc'),output=path.join(directory,name);fs.writeFileSync(file,project.exportRom());
  // Stop high-priority menu music via the native command FIFO ($EE), which
  // otherwise consumes the stream while suppressing announcer playback.
  // Queue the actual native voice IDs: PastThePost2, then its two catalog
  // neighbors LongBall2 and ThrowIn. No replacement loader or DSP harness.
  const result=spawnSync(process.env.PYTHON||'python3',[path.join(__dirname,'snes9x-headless.py'),path.resolve(core),file,output],{encoding:'utf8',timeout:60000,env:{...process.env,ISSD_FRAMES:'2000',ISSD_INPUT:'[[400,20,3],[600,20,3],[800,20,3]]',ISSD_CAPTURE_AUDIO:'1',ISSD_WRAM_WRITES:'[[990,59008,[238]],[990,78,[0,1]],[1010,7470,[62,0]],[1330,7470,[59,0]],[1630,7470,[3,0]]]'}});
  assert.equal(result.status,0,result.stderr);const ram=fs.readFileSync(output+'.ram');assert.equal(ram.readUInt16LE(0x1d08),3,'Following ThrowIn voice must be accepted');assert.equal(ram.readUInt16LE(0x1d1a),0,'Native streamed BRR transfer must finish');assert.equal(ram.readUInt16LE(0x1d2e),0,'Native queue must drain');
  const pcm=fs.readFileSync(output+'.pcm');assert.ok(pcm.length>32000*4*30);recordings.set(name,{pcm,signal:Float64Array.from({length:pcm.length/4},(_,i)=>(pcm.readInt16LE(i*4)+pcm.readInt16LE(i*4+2))/2)});
 }
 const measurements=[];
 for(const [name,recording] of recordings){if(name==='silent'||name.endsWith('-silence'))continue;const baseline=recordings.get(name==='short'?'short-silence':name==='wide'?'wide-silence':name==='user-wav'?'user-silence':name==='sparse'?'sparse-silence':'silent');assert.equal(recording.signal.length,baseline.signal.length);
  const signal=recording.signal.map((v,i)=>v-baseline.signal[i]),active=[];
  for(let i=0;i+128<signal.length&&i<20*32000;i+=128){let energy=0;for(let j=0;j<128;j++)energy+=signal[i+j]**2;if(Math.sqrt(energy/128)>500)active.push(i);}
  assert.ok(active.length,`${name} replacement must be heard through the native PastThePost2 event`);
  const onset=active[0]/32000,duration=(active.at(-1)+128-active[0])/32000;
  let frequency=0,best=0;const start=active[0]+256,count=2048;
  for(let hz=500;hz<=1200;hz+=5){let re=0,im=0;for(let i=0;i<count;i++){const phase=2*Math.PI*hz*i/32000;re+=signal[start+i]*Math.cos(phase);im+=signal[start+i]*Math.sin(phase);}if(re*re+im*im>best){best=re*re+im*im;frequency=hz;}}
  measurements.push({name,onset,duration,frequency});
  assert.deepEqual(recording.pcm.subarray(21*32000*4),baseline.pcm.subarray(21*32000*4),`${name}: following LongBall2 and ThrowIn audio must remain identical`);
 }
 const short=measurements.find(m=>m.name==='short'),long=measurements.find(m=>m.name==='long');
 assert.ok(Math.abs(long.frequency-short.frequency)<=5,'Relocation must preserve the native event pitch');assert.ok(long.frequency>600&&long.frequency<1150,'Real DSP must reproduce the test tone');
 assert.ok(Math.abs(long.duration/short.duration-1.9/.9)<.25,'Relocated voice must play its entire longer duration');
 const sparseResult=measurements.find(m=>m.name==='sparse');assert.ok(Math.abs(sparseResult.duration-long.duration)<.03,'Deleted-team project must retain full long voice playback after export');
 const wide=measurements.find(m=>m.name==='wide');assert.ok(Math.abs(wide.frequency-long.frequency)<=5,'Half-rate playback must preserve native pitch');assert.ok(Math.abs(wide.duration/long.duration-3/1.9)<.05,'Half-rate playback must preserve full duration');
 const toggle=measurements.find(m=>m.name==='toggle');assert.ok(Math.abs(toggle.duration-long.duration)<.03,'Audio prepared by checkbox alone must play its complete expanded duration in Snes9x');assert.ok(Math.abs(toggle.frequency-long.frequency)<=5,'Checkbox regeneration must retain the native pitch');
 const user=measurements.find(m=>m.name==='user-wav');if(user)assert.ok(user.duration>1,'Provided WAV must be heard beyond the original allocation duration');
 fs.writeFileSync(path.join(directory,'measurements.json'),JSON.stringify({trigger:'Native voice queue $1D2E: 62 -> 59 -> 3',measurements},null,2));
 console.log(`PASS long audio runtime: native PastThePost2 streaming/DSP, ${short.duration.toFixed(3)} -> ${long.duration.toFixed(3)} s at matched pitch; LongBall2 and ThrowIn PCM unchanged; deleted-team project boots and plays long audio; checkbox-only preview/export verified${user?'; provided WAV verified':''}. Evidence: ${directory}`);
};
if(require.main===module)module.exports(process.env.SNES9X_CORE).catch(e=>{console.error(e);process.exitCode=1;});
