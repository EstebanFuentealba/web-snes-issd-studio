const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
global.crypto ||= require('node:crypto').webcrypto;
function state(file){const b=fs.readFileSync(file),i=b.indexOf(Buffer.from('SND:'));assert.ok(i>=0);return b.subarray(i+11+65536+164,i+11+65536+164+128);}
module.exports=async function reverbRuntime(core){
 const {RomProject}=await import('../src/rom/project.mjs'),{announcerReverbPatches}=await import('../src/rom/audio-reverb.mjs'),{replacementAudio,pitchRate}=await import('../src/rom/audio-edit.mjs'),{AUDIO_SAMPLES}=await import('../src/rom/audio.mjs');
 const original=fs.readFileSync(path.join(__dirname,'../roms/International Superstar Soccer Deluxe (USA).sfc')),directory=fs.mkdtempSync(path.join(os.tmpdir(),'issd-reverb-runtime-')),rate=pitchRate(1300),sample=AUDIO_SAMPLES.find(s=>s.name==='PastThePost2');
 const input=[[400,20,3],[600,20,3],[800,20,3],[3300,10,8],[3500,10,8],[3800,10,8],[4300,10,3],[4500,10,8],[4800,10,8],[5800,10,3],[6100,10,8],[8000,10,8],[8300,10,8],[8600,10,8],[9000,10,3]];
 const frames=[10700,10810,10820,10840,10860,10900,10930,11000],results=new Map(),measurements=[];
 for(const long of [false,true])for(const dry of [false,true])for(const audible of [false,true]){
  const name=`${long?'long':'native'}-${dry?'dry':'wet'}-${audible?'tone':'silence'}`,p=await RomProject.create(original),duration=long?1.9:.25;
  const wav={sampleRate:rate,samples:Int16Array.from({length:Math.floor(rate*duration)},(_,i)=>audible?Math.round(10000*Math.sin(2*Math.PI*700*i/rate)):0)},edit=replacementAudio(p.bytes(),sample,wav,1300,long);p.transaction(edit.patches||[edit.patch]);
  if(dry)p.transaction(announcerReverbPatches(p.original,p.bytes(),true));
  const file=path.join(directory,name+'.sfc'),output=path.join(directory,name);fs.writeFileSync(file,p.exportRom());
  // Queue the native match voice through the normal streaming protocol.
  const run=spawnSync(process.env.PYTHON||'python3',[path.join(__dirname,'snes9x-headless.py'),path.resolve(core),file,output],{encoding:'utf8',timeout:60000,env:{...process.env,ISSD_FRAMES:'11050',ISSD_INPUT:JSON.stringify(input),ISSD_WRAM_WRITES:'[[10800,7470,[62,0]]]',ISSD_CAPTURE_AUDIO:'1',ISSD_STATE_FRAMES:JSON.stringify(frames)}});assert.equal(run.status,0,run.stderr);
  results.set(name,{pcm:fs.readFileSync(output+'.pcm'),states:frames.map(f=>state(output+`.${f}.state`))});
 }
 function residual(tone,silence,start,end){let sum=0,n=0;for(let i=Math.floor(start*32000)*4;i<Math.floor(end*32000)*4;i+=2){sum+=(tone.readInt16LE(i)-silence.readInt16LE(i))**2;n++;}return Math.sqrt(sum/n);}
 for(const prefix of ['native','long']){
  const wet=results.get(prefix+'-wet-tone'),dry=results.get(prefix+'-dry-tone'),wetSilent=results.get(prefix+'-wet-silence'),drySilent=results.get(prefix+'-dry-silence');

  assert.ok(wet.states.some(d=>d[0x58]>0),`${prefix}: real announcer voice must sound`);
  let lastActive=0;
  for(let i=0;i<frames.length;i++){
   const w=wet.states[i],d=dry.states[i];assert.equal(w[0x4d],255);assert.equal(d[0x4d],223,'Only announcer voice 5 must lose its echo send');
   // Recompressing the native driver changes boot timing, hence sample phase
   // and game RNG. Compare stable echo configuration, not unrelated PCM phases.
   for(const reg of [0x0c,0x1c,0x2c,0x3c,0x0d,0x6d,0x7d,...Array.from({length:8},(_,i)=>i*16+15)])assert.equal(d[reg],w[reg],`${prefix}: preserve echo register ${reg.toString(16)}`);
   assert.ok(d[0x38]>0&&d[0x48]>0,`${prefix}: both crowd channels must remain audible`);
   if(w[0x58]>0)lastActive=frames[i];
  }
  assert.ok(lastActive>10800);
  let first=-1,last=-1;
  for(let i=179*32000*4;i<dry.pcm.length;i+=2)if(Math.abs(dry.pcm.readInt16LE(i)-drySilent.pcm.readInt16LE(i))>50){if(first<0)first=i;last=i;}
  assert.ok(first>=0&&last>first,`${prefix}: dry voice must be audible`);
  const voiceDuration=(last-first)/(32000*4);assert.ok(Math.abs(voiceDuration-(prefix==='native'?.25:1.9))<.08,`${prefix}: preserve full voice duration (${voiceDuration})`);
  const start=last/(32000*4)+.01,end=start+.2;
  const wetTail=residual(wet.pcm,wetSilent.pcm,start,end),dryTail=residual(dry.pcm,drySilent.pcm,start,end);
  assert.ok(wetTail>20,`${prefix}: reproduce audible echo tail (${wetTail})`);
  assert.ok(dryTail<wetTail*.05,`${prefix}: remove echo tail (${dryTail} vs ${wetTail})`);
  measurements.push({fixture:prefix,lastActive,voiceDuration,wetTailRms:wetTail,dryTailRms:dryTail,crowdActive:true,echoParametersPreserved:true});
 }
 fs.writeFileSync(path.join(directory,'measurements.json'),JSON.stringify(measurements,null,2));
 console.log(`PASS commentary reverb runtime: native/long match voices, real DSP EON FF -> DF, echo tails removed, crowd active and echo parameters preserved. Evidence: ${directory}`);
 return directory;
};
if(require.main===module)module.exports(process.env.SNES9X_CORE).catch(e=>{console.error(e);process.exitCode=1;});
