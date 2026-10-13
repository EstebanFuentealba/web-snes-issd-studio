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
 editor.setStretch(2);assert.equal(range.end,1);assert.equal(editor.outputDuration,2);editor.fitStretch();assert.equal(editor.outputDuration,.8);editor.setStretch(2);editor.fit();assert.equal(range.end,.4);assert.equal(editor.outputDuration,.8);editor.setEnd(1);assert.equal(range.end,.4);editor.commit();assert.equal(range.stretch,2);
 let captured;editor.$refs.track={getBoundingClientRect:()=>({width:200})};editor.beginStretch({clientX:200,pointerId:1,preventDefault(){},currentTarget:{setPointerCapture:id=>captured=id}});assert.equal(captured,1);editor.moveStretch({clientX:160});assert.ok(editor.stretch<2);assert.equal(range.stretch,2);editor.finishStretch();assert.equal(range.stretch,editor.stretch);editor.setStretch(2);
 // Both controls share output-time coordinates, including zoom and offset trims.
 editor.start=.1;editor.end=.4;editor.viewStart=.05;editor.viewSpan=.6;editor.stretch=.5;
 assert.equal(editor.percent(editor.start),editor.percent(.1));assert.ok(Math.abs(editor.percent(editor.end)-25)<1e-8);
 const originalRange={start:editor.start,end:editor.end};editor.beginStretch({clientX:100,pointerId:2,preventDefault(){},currentTarget:{setPointerCapture(){}}});editor.moveStretch({clientX:150});editor.finishStretch();assert.ok(Math.abs(editor.stretch-1)<1e-8);assert.equal(editor.start,originalRange.start);assert.equal(editor.end,originalRange.end);
 // Contracting expands the blue selection without moving its start.
 editor.source={samples:new Int16Array(48000),sampleRate:16000};editor.maxDuration=.8;editor.initialize();assert.equal(editor.end,.8);
 editor.setStretch(.5);assert.equal(editor.end,1.6);assert.equal(editor.outputDuration,.8);
 editor.setStretch(.25);assert.equal(editor.end,3);assert.equal(editor.outputDuration,.75);
 editor.initialize();editor.start=.2;editor.end=1;editor.fitStretch();assert.ok(Math.abs(editor.end-3)<1e-8);assert.ok(editor.outputDuration<=.8);assert.equal(editor.start,.2);
 editor.initialize();editor.beginStretch({clientX:100,pointerId:3,preventDefault(){},currentTarget:{setPointerCapture(){}}});editor.moveStretch({clientX:80});const midFactor=editor.stretch;editor.moveStretch({clientX:70});assert.ok(editor.stretch<midFactor);assert.ok(editor.end>.8);editor.moveStretch({clientX:100});assert.equal(editor.stretch,1);assert.equal(editor.end,.8);editor.moveStretch({clientX:70});editor.finishStretch();assert.ok(editor.end*editor.stretch<=editor.viewStart+editor.viewSpan);assert.equal(range.end,editor.end);
 editor.start=.2;editor.end=2.2;editor.stretch=.25;assert.ok(Math.abs(editor.waveSourceTime(.4)-1.6)<1e-8);assert.equal(editor.waveSourceTime(.5),2);assert.equal(editor.waveSourceTime(.1),.4);
 for(const factor of [.1,.25,.5,1,2]){editor.stretch=factor;const steps=100;for(let i=0;i<steps;i++){const t=editor.start*factor+(editor.end-editor.start)*factor*i/steps;const mapped=editor.waveSourceTime(t);assert.ok(mapped>=editor.start-1e-9&&mapped<editor.end);}}
 assert.equal((source.match(/<canvas\s/g)||[]).length,1);assert.equal((source.match(/<svg/g)||[]).length,0);
 editor.setStretch(2);
 editor.setStretch(NaN);assert.equal(editor.stretch,2);editor.initialize();assert.equal(editor.stretch,1);
 console.log('PASS audio stretch: duration, unchanged pitch, silence/short clips, immutable input, limits and trim capacity controls');
})().catch(e=>{console.error(e);process.exitCode=1;});
