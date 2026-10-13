const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
global.crypto ||= require('node:crypto').webcrypto;
module.exports=async function audioGoalRuntime(core){
 const {RomProject}=await import('../src/rom/project.mjs'),{audioRegion,replacementAudio,encodeBrr,pitchRate}=await import('../src/rom/audio-edit.mjs'),{AUDIO_SAMPLES}=await import('../src/rom/audio.mjs');
 const original=fs.readFileSync(path.join(__dirname,'../roms/International Superstar Soccer Deluxe (USA).sfc'));
 const goal=AUDIO_SAMPLES.find(s=>s.name==='GOOOOOOOOOOOOAAAAAALLLLLL'),title=AUDIO_SAMPLES.find(s=>s.name==='TitleScreenNameDrop');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'issd-goal-runtime-')),recordings=[];
 for(const audible of [false,true]){
  const project=await RomProject.create(original),region=audioRegion(project.bytes(),goal),rate=pitchRate(1300);
  const wav={samples:Int16Array.from({length:region.capacity/9*16},(_,i)=>audible?Math.round(12000*Math.sin(2*Math.PI*700*i/rate)):0),sampleRate:rate};
  const replacement=replacementAudio(project.bytes(),goal,wav,1300);project.transaction([replacement.patch]);
  const rom=project.exportRom(),bank=audioRegion(rom,title);
  // Test-only harness: route the actual exported goal BRR through the native
  // second title voice trigger, retaining the original SPC directory.
  // Subsequent title fragments remain silent. This tests real DSP termination,
  // not the match's goal-event trigger (which is not exercised here).
  const silence=encodeBrr(new Int16Array(bank.capacity/9*16),bank.capacity);
  for(let i=0;i<silence.length;i+=9)silence[i]=(silence[i]&0xfc)|(bank.bytes[i]&3);
  for(let i=200*9;i<400*9;i+=9)silence[i]&=0xfc;
  silence.set(rom.subarray(region.offset,region.offset+region.capacity),200*9);rom.set(silence,bank.offset);
  const file=path.join(directory,`goal-${audible}.sfc`),output=path.join(directory,`goal-${audible}`);fs.writeFileSync(file,rom);
  const result=spawnSync(process.env.PYTHON||'python3',[path.join(__dirname,'snes9x-headless.py'),path.resolve(core),file,output],{encoding:'utf8',timeout:60000,env:{...process.env,ISSD_FRAMES:'750',ISSD_INPUT:'[[400,20,3]]',ISSD_CAPTURE_AUDIO:'1'}});
  assert.equal(result.status,0,result.stderr);const pcm=fs.readFileSync(output+'.pcm');assert.ok(pcm.length>32000*4*11);
  recordings.push(Float64Array.from({length:pcm.length/4},(_,i)=>(pcm.readInt16LE(i*4)+pcm.readInt16LE(i*4+2))/2));
 }
 const [silent,audible]=recordings;assert.equal(silent.length,audible.length);
 const active=[];
 for(let i=0;i+128<=silent.length;i+=128){let energy=0;for(let j=0;j<128;j++)energy+=(audible[i+j]-silent[i+j])**2;if(Math.sqrt(energy/128)>500)active.push(i);}
 assert.ok(active.length,'Exported goal replacement must produce real DSP audio');
 const onset=active[0]/32000,duration=(active.at(-1)+128-active[0])/32000;
 assert.ok(duration>.2&&duration<.6,`Full replacement must end once rather than follow the old loop: ${duration}s`);
 assert.ok(silent.length/32000-onset-duration>1.5,'Record long enough to detect any repeated voice after termination');
 const start=active[0]+256,count=2048;let frequency=0,best=0;
 for(let hz=550;hz<=900;hz+=5){let re=0,im=0;for(let i=0;i<count;i++){const value=audible[start+i]-silent[start+i],phase=2*Math.PI*hz*i/32000;re+=value*Math.cos(phase);im+=value*Math.sin(phase);}if(re*re+im*im>best){best=re*re+im*im;frequency=hz;}}
 assert.ok(Math.abs(frequency-700)<40,`Expected replacement tone in DSP output, got ${frequency} Hz`);
 fs.writeFileSync(path.join(directory,'measurements.json'),JSON.stringify({onset,duration,frequency,harness:'Exported goal BRR through native title voice; match goal trigger not covered'},null,2));
 console.log(`PASS goal one-shot runtime: real DSP ${frequency} Hz, ${duration.toFixed(3)} s, finite playback with the original SPC directory. Title-trigger harness evidence: ${directory}`);
};
if(require.main===module)module.exports(process.env.SNES9X_CORE).catch(e=>{console.error(e);process.exitCode=1;});
