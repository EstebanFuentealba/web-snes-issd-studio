const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const {stretchAudio}=await import('../src/rom/audio-edit.mjs');
 const wav={samples:Int16Array.from({length:16000},(_,i)=>Math.round(12000*Math.sin(2*Math.PI*440*i/16000))),sampleRate:16000},copy=wav.samples.slice();
 for(const factor of [.1,.25,.5,.75,1,1.5,2]){
  const result=stretchAudio(wav,factor);assert.equal(result.sampleRate,wav.sampleRate);assert.equal(result.samples.length,Math.round(wav.samples.length*factor));
  const margin=Math.min(1000,Math.floor(result.samples.length/8));let crossings=0;for(let i=margin+1;i<result.samples.length-margin;i++)if(result.samples[i-1]<=0&&result.samples[i]>0)crossings++;
  assert.ok(Math.abs(crossings*16000/(result.samples.length-margin*2)-440)<12,`Pitch preserved at ${factor}`);
 }
 assert.deepEqual(wav.samples,copy);assert.deepEqual(stretchAudio(wav,1).samples,copy);assert.notEqual(stretchAudio(wav,1).samples,wav.samples);
 for(const factor of [.09,2.01,NaN,Infinity])assert.throws(()=>stretchAudio(wav,factor),/stretch/);
 assert.deepEqual(stretchAudio({samples:new Int16Array(1000),sampleRate:16000},2).samples,new Int16Array(2000));
 for(const length of [0,1,15,100])for(const factor of [.5,2])assert.equal(stretchAudio({samples:new Int16Array(length).fill(1234),sampleRate:16000},factor).samples.length,Math.round(length*factor));
 // Exercise trim controls: capacity is measured after stretch, with original time coordinates.
 const source=fs.readFileSync(__dirname+'/../src/components/AudioTrim.vue','utf8'),options=new Function(source.split('<script>')[1].split('</script>')[0].replace('export default','return'))();
 let range;const editor={...options.data(),source:{...wav,name:'tone'},maxDuration:.8,$refs:{},$nextTick(){},$emit(event,value){if(event==='range')range=value;}};
 for(const [name,method] of Object.entries(options.methods))editor[name]=method.bind(editor);
 for(const [name,get] of Object.entries(options.computed))Object.defineProperty(editor,name,{get:get.bind(editor)});
 editor.initialize();assert.equal(range.stretch,1);editor.setStretch(.5);editor.full();assert.equal(range.end,1);assert.equal(editor.outputDuration,.5);
 editor.setStretch(2);assert.equal(range.end,1);assert.equal(editor.outputDuration,2);editor.fitStretch();assert.equal(editor.outputDuration,.8);editor.setStretch(2);editor.fit();assert.equal(range.end,.4);assert.equal(editor.outputDuration,.8);editor.setEnd(1);editor.commit();assert.equal(range.end,1);assert.ok(editor.clipEnd>editor.maxDuration);editor.fit();assert.equal(range.end,.4);assert.equal(range.stretch,2);
 let captured;editor.$refs.track={getBoundingClientRect:()=>({width:200})};editor.beginStretch({clientX:200,pointerId:1,preventDefault(){},currentTarget:{setPointerCapture:id=>captured=id}});assert.equal(captured,1);editor.moveStretch({clientX:160});assert.ok(editor.stretch<2);assert.equal(range.stretch,2);editor.finishStretch();assert.equal(range.stretch,editor.stretch);editor.setStretch(2);
 // Clip movement changes placement, while trim uses source coordinates.
 editor.initialize();editor.start=.1;editor.end=.4;editor.stretch=.5;editor.offset=.2;editor.viewStart=.05;editor.viewSpan=.6;
 assert.ok(Math.abs(editor.percent(editor.start)-25)<1e-8);
 assert.ok(Math.abs(editor.percent(editor.end)-50)<1e-8);
 assert.equal(editor.waveSourceTime(.19),null);assert.equal(editor.waveSourceTime(.36),null);
 assert.ok(Math.abs(editor.waveSourceTime(.25)-.2)<1e-8);
 editor.shift(.1);assert.equal(editor.start,.1);assert.equal(editor.end,.4);assert.ok(Math.abs(range.offset-.3)<1e-8);
 editor.setFade('in',.05);editor.setFade('out',.1);editor.commit();assert.equal(range.fadeIn,.05);assert.equal(range.fadeOut,.1);
 editor.beginFade({clientX:100,clientY:50,pointerId:4,preventDefault(){},currentTarget:{setPointerCapture(){}}},'in');
 editor.moveFade({clientX:110,clientY:80});editor.finishFade();assert.ok(editor.fadeIn>.05);assert.equal(editor.fadeInCurve,1.5);
 const before=editor.clipEnd;editor.setStart(.15);editor.commit();assert.ok(Math.abs(editor.clipEnd-before)<1e-8);assert.ok(editor.offset>.3);
 editor.setEnd(.2);editor.commit();assert.ok(range.fadeOut<=editor.outputDuration);
 editor.setOffset(100);assert.ok(editor.clipEnd<=editor.maxDuration+1e-9);
 assert.equal((source.match(/<canvas\s/g)||[]).length,1);assert.equal((source.match(/<svg/g)||[]).length,1);
 const {renderAudioEdit}=await import('../src/rom/audio-edit.mjs');
 const constant={samples:new Int16Array(16000).fill(10000),sampleRate:16000};
 const faded=renderAudioEdit(constant,{start:.25,end:.75,stretch:1,offset:.1,fadeIn:.1,fadeOut:.1,fadeInCurve:2});
 assert.equal(faded.samples.length,9600);assert.ok(faded.samples.slice(0,1601).every(v=>v===0));
 assert.equal(faded.samples[2400],2500);assert.equal(faded.samples[5000],10000);assert.equal(faded.samples.at(-1),0);
 assert.equal(constant.samples[0],10000);assert.throws(()=>renderAudioEdit(constant,{start:0,end:1,offset:-1}),/inválida/);
 const trimmedEnd=editor.end,trimmedStart=editor.start;editor.setStretch(.25);assert.equal(editor.start,trimmedStart);assert.equal(editor.end,trimmedEnd);
 editor.full();assert.equal(editor.start,0);assert.equal(editor.end,editor.duration);assert.equal(editor.offset,0);
 editor.setStretch(2);
 editor.setStretch(NaN);assert.equal(editor.stretch,2);editor.initialize();assert.equal(editor.stretch,1);
 console.log('PASS audio stretch: duration, unchanged pitch, silence/short clips, immutable input, limits and trim capacity controls');
})().catch(e=>{console.error(e);process.exitCode=1;});
