const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
global.crypto ||= require('node:crypto').webcrypto;
module.exports=async function audioStretchRuntime(core){
 const {RomProject}=await import('../src/rom/project.mjs'),{stretchAudio,renderAudioEdit,replacementAudio}=await import('../src/rom/audio-edit.mjs'),{AUDIO_SAMPLES}=await import('../src/rom/audio.mjs');
 const original=fs.readFileSync(path.join(__dirname,'../roms/International Superstar Soccer Deluxe (USA).sfc')),directory=fs.mkdtempSync(path.join(os.tmpdir(),'issd-stretch-runtime-'));
 const wav={samples:Int16Array.from({length:4800},(_,i)=>Math.round(12000*Math.sin(2*Math.PI*700*i/16000))),sampleRate:16000};
 const recordings=new Map();
 for(const factor of [0,.1,.3,'placed','envelope']){
  const project=await RomProject.create(original),replacement=replacementAudio(project.bytes(),AUDIO_SAMPLES.find(s=>s.name==='TitleScreenNameDrop'),factor==='placed'?renderAudioEdit(wav,{start:.05,end:.25,stretch:.45,offset:.03}):factor==='envelope'?renderAudioEdit(wav,{start:.05,end:.25,stretch:.45,offset:.03,fadeIn:.025,fadeOut:.025,fadeInCurve:2,fadeOutCurve:2}):factor?stretchAudio(wav,factor):{samples:new Int16Array(4800),sampleRate:16000},1300);
  project.transaction([replacement.patch]);const rom=path.join(directory,`stretch-${factor}.sfc`),output=path.join(directory,`stretch-${factor}`);fs.writeFileSync(rom,project.exportRom());
  const result=spawnSync(process.env.PYTHON||'python3',[path.join(__dirname,'snes9x-headless.py'),path.resolve(core),rom,output],{encoding:'utf8',timeout:60000,env:{...process.env,ISSD_FRAMES:'650',ISSD_INPUT:'[[400,20,3]]',ISSD_CAPTURE_AUDIO:'1'}});
  assert.equal(result.status,0,result.stderr);const pcm=fs.readFileSync(output+'.pcm');
  assert.ok(pcm.length>32000*4*9,'Snes9x must deliver real stereo audio');
  recordings.set(factor,Float64Array.from({length:pcm.length/4},(_,i)=>(pcm.readInt16LE(i*4)+pcm.readInt16LE(i*4+2))/2));
 }
 // Subtract an otherwise identical silent title sample to isolate this voice
 // from the game's background music. Compare actual DSP output, including echo.
 const silent=recordings.get(0),measurements=[];
 for(const factor of [.1,.3]){
  const pcm=recordings.get(factor);assert.equal(pcm.length,silent.length);
  const signal=pcm.map((v,i)=>v-silent[i]),runs=[];
  for(let i=0;i+64<=signal.length;i+=64){
   let energy=0;for(let j=0;j<64;j++)energy+=signal[i+j]**2;
   if(Math.sqrt(energy/64)>500){if(!runs.length||i>runs.at(-1).end+64)runs.push({start:i,end:i});else runs.at(-1).end=i;}
  }
  assert.ok(runs.length,'The edited title sample must be heard in Snes9x');
  const first=runs[0],start=first.start+64,count=640;
  let frequency=0,best=0;
  for(let hz=500;hz<=1000;hz+=5){let re=0,im=0;for(let i=0;i<count;i++){const phase=2*Math.PI*hz*i/32000;re+=signal[start+i]*Math.cos(phase);im+=signal[start+i]*Math.sin(phase);}const energy=re*re+im*im;if(energy>best){best=energy;frequency=hz;}}
  measurements.push({factor,onset:first.start/32000,duration:(first.end+64-first.start)/32000,frequency});
 }
 assert.equal(measurements[0].onset,measurements[1].onset,'Stretch must preserve the event trigger');
 assert.ok(Math.abs(measurements[0].frequency-measurements[1].frequency)<=5,'Initial pitch must remain unchanged in the real DSP output');
 assert.ok(measurements[0].frequency>600&&measurements[0].frequency<900,'The test tone must survive BRR conversion and DSP playback');
 assert.ok(Math.abs(measurements[1].duration/measurements[0].duration-3)<.35,'The longer stretch must sound approximately three times longer');
 const envelope=recordings.get('envelope').map((v,i)=>v-silent[i]);
 const placed=recordings.get('placed').map((v,i)=>v-silent[i]);
 const baseline=measurements[1].onset;
 const rms=(from,to,signal=envelope)=>{let sum=0,n=0;for(let i=Math.round(from*32000);i<Math.round(to*32000);i++){sum+=signal[i]**2;n++;}return Math.sqrt(sum/n);};
 assert.ok(rms(baseline+.002,baseline+.025)<100,'Moving the clip must insert silence in real DSP playback');
 const middle=rms(baseline+.065,baseline+.085),attack=rms(baseline+.034,baseline+.042),release=rms(baseline+.098,baseline+.106),plainTail=rms(baseline+.098,baseline+.106,placed);
 assert.ok(middle>500,'The trimmed, moved and faded clip must be audible in Snes9x');
 assert.ok(attack<middle*.7,'Fade in must attenuate the attack in real DSP output');
 assert.ok(plainTail>500,'The unfaded reference must still be sounding during the fade out check');
 assert.ok(release<plainTail*.7,'Fade out must attenuate the tail in real DSP output');
 measurements.push({edit:'trim + placement + curved fades',attack,middle,release,plainTail});
 fs.writeFileSync(path.join(directory,'measurements.json'),JSON.stringify(measurements,null,2));
 console.log(`PASS audio stretch runtime: real DSP PCM, matched pitch ${measurements[0].frequency} Hz, durations ${measurements.filter(m=>m.duration).map(m=>m.duration.toFixed(3)).join(' / ')} s. Evidence: ${directory}`);
 console.log(`Audio stretch runtime evidence: ${directory}`);
};
if(require.main===module)module.exports(process.env.SNES9X_CORE).catch(e=>{console.error(e);process.exitCode=1;});
