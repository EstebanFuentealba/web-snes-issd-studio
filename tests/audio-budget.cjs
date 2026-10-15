const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const {calculateAudioBudget,audioBudget}=await import('../src/rom/audio-budget.mjs'),{LONG_AUDIO}=await import('../src/rom/audio-long.mjs');
 const entry=(name,extended=false)=>({name,nativeCapacity:900,bytes:extended?1800:900,extended,canExtend:true});
 let budget=calculateAudioBudget([entry('A'),entry('B')]);
 assert.equal(budget.used,1800);assert.equal(budget.capacity,1800+32*32768);assert.equal(budget.banks,0);assert.equal(budget.overflow,false);
 budget=calculateAudioBudget([entry('A'),entry('B')],{name:'A',bytes:909,long:false});
 assert.equal(budget.rows[0].overflow,true);assert.equal(budget.rows[1].overflow,false);assert.equal(budget.banks,0);
 budget=calculateAudioBudget([entry('A'),entry('B')],{name:'A',bytes:1800,long:true});
 assert.equal(budget.used,1800+32768);assert.equal(budget.banks,1);assert.equal(budget.overflow,false);assert.equal(budget.rows[0].storedBytes,1802);
 budget=calculateAudioBudget([entry('A',true)],{name:'A',bytes:LONG_AUDIO.capacity,long:true});
 assert.equal(budget.banks,1);assert.equal(budget.overflow,false);assert.equal(budget.rows[0].storedBytes,2+LONG_AUDIO.capacity+Math.ceil(LONG_AUDIO.capacity/18)*9);assert.ok(budget.rows[0].storedBytes<=32768);
 budget=calculateAudioBudget([entry('A',true)],{name:'A',bytes:LONG_AUDIO.capacity+9,long:true});assert.equal(budget.rows[0].overflow,true);
 const full=Array.from({length:32},(_,i)=>entry('long'+i,true));full.push(entry('new'));
 budget=calculateAudioBudget(full);assert.equal(budget.used,budget.capacity);assert.equal(budget.overflow,false);
 budget=calculateAudioBudget(full,{name:'new',bytes:1800,long:true});assert.equal(budget.banks,33);assert.ok(budget.used>budget.capacity);assert.equal(budget.rows.at(-1).overflow,true);assert.ok(budget.rows.slice(0,32).every(e=>!e.overflow));
 budget=calculateAudioBudget(full,{name:'long0',bytes:2700,long:true});assert.equal(budget.banks,32);assert.equal(budget.overflow,false);
 budget=calculateAudioBudget([{...entry('protected'),canExtend:false}],{name:'protected',bytes:1800,long:true});assert.equal(budget.banks,0);assert.equal(budget.overflow,true);
 const rom=new Uint8Array(fs.readFileSync('roms/International Superstar Soccer Deluxe (USA).sfc')),before=rom.slice(),native=audioBudget(rom);
 assert.equal(native.rows.length,76);assert.equal(native.banks,0);assert.equal(native.used,native.rows.reduce((s,r)=>s+r.weight,0));assert.deepEqual(rom,before);
 // Exercise the actual parent computed property: invalid/oversized trims still
 // reach the visualization even when conversion refuses to create a preview.
 const {parse}=require('@babel/parser'),script=fs.readFileSync('src/components/StudioEditor.vue','utf8').split('<script>')[1].split('</script>')[0],component=parse(script,{sourceType:'module'}).program.body.find(n=>n.type==='ExportDefaultDeclaration').declaration;
 const getter=component.properties.find(n=>n.key.name==='computed').value.properties.find(n=>n.key.name==='audioBudgetInfo');
 const compute=new Function('audioBudget',`return ({${script.slice(getter.start,getter.end)}}).audioBudgetInfo`)(audioBudget);
 const name='PastThePost2',parent={rom,audioSamples:[{name}],sampleIndex:0,audioSource:{},audioRange:{start:0,end:10,stretch:2,offset:1},audioRate:10156.25,audioLong:true};
 budget=compute.call(parent);assert.equal(budget.rows.find(r=>r.name===name).overflow,true);assert.equal(budget.rows.find(r=>r.name===name).preview,true);
 parent.audioSource=null;assert.equal(compute.call(parent).overflow,false);
 console.log('PASS audio budget: native allocations, bank reservations, reduced playback copies, individual overflow, 32-bank exhaustion, replacement at full capacity and pending oversized trims');
})().catch(e=>{console.error(e);process.exitCode=1;});
