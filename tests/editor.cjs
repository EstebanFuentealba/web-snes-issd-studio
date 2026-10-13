const assert=require('assert/strict'),fs=require('fs'),path=require('path');
global.crypto ||= require('crypto').webcrypto;global.Blob ||= require('buffer').Blob;global.btoa ||= s=>Buffer.from(s,'binary').toString('base64');global.atob ||= s=>Buffer.from(s,'base64').toString('binary');
(async()=>{
 const {readFormation,formationPatch}=await import('../src/rom/formations.mjs');
 const {RomProject}=await import('../src/rom/project.mjs');
 const {word,loRom,tiles,decompress}=await import('../src/rom/binary.mjs');
 const {encodeTiles,compress,graphicResources,graphicPatch,graphicPatches,flagPatches,flagMatrix,FLAG_POOL,FLAG_POOL_SIZE,FLAG_TEMPLATE,FLAG_TABLE,smallLabelPatches,smallLabelMatrix,LABEL_TEMPLATE,flagPalettePatches,rgb555}=await import('../src/rom/graphics.mjs');
 const {imagePalette}=await import('../src/rom/image-import.mjs');
 const rgba=Uint8Array.from([255,0,0,255,0,0,255,255,255,255,255,255,255,255,0,255,0,255,0,0]);assert.deepEqual(new Set(imagePalette(rgba)),new Set(['#ff0000','#0000ff','#ffffff','#ffff00']));
 const {playerPatches,encodeName}=await import('../src/rom/players.mjs');
 const {readDeluxeTeam,deluxeText}=await import('../src/rom/deluxe.mjs');
 const {encodeBrr,parseWav,resample,pitchRate,audioRegion,replacementAudio,trimAudio,floatChannelsToMono,decodeUploadedAudio,normalizeAudio,normalizedAudioPatches}=await import('../src/rom/audio-edit.mjs');
 const {decodeBrr,wavBlob,AUDIO_SAMPLES}=await import('../src/rom/audio.mjs');
 for(const bpp of [2,4,8]) {const matrix=Array.from({length:16},(_,y)=>Array.from({length:24},(_,x)=>(x+y*7)%(2**bpp)));assert.deepEqual(tiles(encodeTiles(matrix,bpp),bpp,3),matrix);}
 for(const input of [new Uint8Array(768),Uint8Array.from({length:2048},(_,i)=>(i*13)%256),Uint8Array.from({length:256},(_,i)=>i%3?0:82),Uint8Array.from({length:160},(_,i)=>i%8)])for(const interleaved of [false,true])assert.deepEqual(decompress(compress(input,interleaved),0),input);
 assert.deepEqual([...rgb555('#ffffff')],[255,127]);assert.throws(()=>rgb555('bad'));assert.equal(deluxeText(encodeName('A.b/c')), 'A.b/c');assert.throws(()=>encodeName('Álvarez'));assert.throws(()=>encodeName('123456789'));
 const input=Int16Array.from({length:160},(_,i)=>Math.round(Math.sin(i/10)*12000)),brr=encodeBrr(input,90),pcm=decodeBrr(brr);assert.equal(pcm.length,160);assert.ok(pcm.reduce((sum,v,i)=>sum+(v-input[i])**2,0)/160<1000000);assert.equal(pitchRate(1300),10156.25);assert.equal(resample(input,8000,12000).length,240);assert.throws(()=>encodeBrr(input,9),/capacidad/);
 // Source level and long silence must not determine the replacement's volume.
 const rms=samples=>Math.sqrt(samples.reduce((sum,v)=>sum+v*v,0)/samples.length);
 const levels=[500,6000,28000].map(level=>normalizeAudio(Int16Array.from({length:1600},(_,i)=>Math.round(Math.sin(i*Math.PI/20)*level))));
 for(const level of levels){assert.ok(Math.abs(rms(level)-8192)<300);const decoded=decodeBrr(encodeBrr(level,900));assert.ok(Math.abs(rms(decoded)-8192)<600);}
 const padded=new Int16Array(4800);padded.set(input,1600);const normalizedPadded=normalizeAudio(padded);
 assert.deepEqual(normalizedPadded.slice(1600,1760),normalizeAudio(input));assert.ok(normalizedPadded.slice(0,1600).every(v=>v===0));assert.ok(normalizedPadded.slice(1760).every(v=>v===0));assert.deepEqual(normalizeAudio(new Int16Array(160)),new Int16Array(160));assert.deepEqual(normalizeAudio(new Int16Array()),new Int16Array());
 const transient=Int16Array.from({length:1600},(_,i)=>i===800?32767:i===801?-32768:i%2?500:-500),transientCopy=transient.slice(),limited=normalizeAudio(transient),limitedBrr=decodeBrr(encodeBrr(limited,900));
 assert.deepEqual(transient,transientCopy);assert.ok(limited.every(v=>Math.abs(v)<=28672));assert.ok(Math.abs(rms(limited)-8192)<2);assert.ok(limitedBrr[800]>0&&limitedBrr[801]<0);
 const wav=await wavBlob(input,12000).arrayBuffer();assert.deepEqual(parseWav(wav).samples,input);assert.equal(parseWav(wav).sampleRate,12000);assert.throws(()=>parseWav(new ArrayBuffer(44)));assert.throws(()=>parseWav(wav.slice(0,-1)),/truncado/);
 // High-resolution WAVs are normalized to PCM16 mono before BRR conversion.
 const makeWav=(type,bits,values,channels=1)=>{
   const size=values.length*bits/8,buffer=new ArrayBuffer(44+size),v=new DataView(buffer),tag=(o,s)=>Array.from(s).forEach((c,i)=>v.setUint8(o+i,c.charCodeAt(0)));
   tag(0,'RIFF');v.setUint32(4,36+size,true);tag(8,'WAVE');tag(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,type,true);v.setUint16(22,channels,true);v.setUint32(24,48000,true);v.setUint32(28,48000*channels*bits/8,true);v.setUint16(32,channels*bits/8,true);v.setUint16(34,bits,true);tag(36,'data');v.setUint32(40,size,true);
   values.forEach((value,i)=>{const offset=44+i*bits/8;if(type===3){bits===32?v.setFloat32(offset,value,true):v.setFloat64(offset,value,true);}else if(bits===32)v.setInt32(offset,value,true);else if(bits===24){v.setUint8(offset,value&255);v.setUint8(offset+1,(value>>>8)&255);v.setUint8(offset+2,(value>>>16)&255);}});return buffer;
 };
 assert.deepEqual([...parseWav(makeWav(1,24,[-8388608,0,8388607])).samples],[-32768,0,32767]);
 assert.deepEqual([...parseWav(makeWav(1,32,[-2147483648,0,2147483647])).samples],[-32768,0,32767]);
 assert.deepEqual([...parseWav(makeWav(3,32,[1,1,-1,-1,.5,.5],2)).samples],[32767,-32768,16384]);
 assert.deepEqual([...parseWav(makeWav(3,64,[NaN,Infinity,-.5])).samples],[0,0,-16384]);
 assert.deepEqual([...floatChannelsToMono([Float32Array.of(1,-1),Float32Array.of(1,-1)])],[32767,-32768]);
 assert.deepEqual([...((await decodeUploadedAudio(makeWav(3,32,[.5]))).samples)],[16384]);
 const cut=trimAudio({samples:Int16Array.from({length:1000},(_,i)=>i),sampleRate:1000},.2,.4);assert.equal(cut.samples.length,200);assert.equal(cut.samples[0],200);assert.equal(cut.samples.at(-1),399);
 assert.throws(()=>trimAudio(cut,0,0),/recorte/);assert.throws(()=>trimAudio(cut,0,1),/recorte/);
 const plain=makeWav(3,32,[.25,.75],2),extended=new Uint8Array(plain.byteLength+24),extView=new DataView(extended.buffer);
 extended.set(new Uint8Array(plain).slice(0,36));extView.setUint32(4,extended.length-8,true);extView.setUint32(16,40,true);extView.setUint16(20,0xfffe,true);extView.setUint16(36,22,true);extView.setUint16(38,32,true);extView.setUint32(44,3,true);extended.set([0,0,16,0,128,0,0,170,0,56,155,113],48);extended.set(new Uint8Array(plain).slice(36),60);
 assert.deepEqual([...parseWav(extended.buffer).samples],[16384]);
 const file=path.resolve(__dirname,'../roms/International Superstar Soccer Deluxe (USA).sfc');
 if(!fs.existsSync(file)){console.log('SKIP editor local ROM tests');return;}
 const original=new Uint8Array(fs.readFileSync(file)),project=await RomProject.create(original);
 assert.deepEqual(project.exportRom(),original);
 const headered=new Uint8Array(original.length+512);headered.set(Uint8Array.from({length:512},(_,i)=>i&255));headered.set(original,512);const smc=await RomProject.create(headered);assert.deepEqual(smc.exportRom(),headered);
 const conflictRom=original.slice();const italyNames=word(conflictRom,0x38138);conflictRom[0x3813a]=(italyNames+1)&255;conflictRom[0x3813b]=(italyNames+1)>>>8;const conflict=await RomProject.create(conflictRom);assert.throws(()=>conflict.transaction([...playerPatches(conflict.bytes(),0,0,{name:'Test'}),...playerPatches(conflict.bytes(),1,0,{name:'Other'})]),/Conflicto/);
 const before=readDeluxeTeam(original,0).players[0];project.transaction(playerPatches(project.bytes(),0,0,{name:'Codex',no:2,hair:13,speed:5}));const after=readDeluxeTeam(project.bytes(),0).players[0];assert.equal(after.name,'Codex');assert.equal(after.hair,13);assert.equal(after.speed,5);assert.equal(after.no,2);assert.equal(after.energy,before.energy);assert.equal(after.position,before.position);const detached=project.original;detached.fill(0);assert.deepEqual(project.original,original);
 project.undo();assert.deepEqual(project.exportRom(),original);project.redo();assert.equal(readDeluxeTeam(project.bytes(),0).players[0].name,'Codex');
 assert.throws(()=>project.transaction([{id:'evil',offset:0,bytes:Uint8Array.of(1)}]),/permitido/);
 assert.throws(()=>project.transaction([{id:'evil',offset:0,bytes:original.slice(0,1)}]),/permitido/);
 assert.throws(()=>project.transaction(playerPatches(project.bytes(),0,0,{position:7})),/inválido/);
 const invalid=playerPatches(project.bytes(),0,1,{speed:3})[0];invalid.bytes[0]=255;assert.throws(()=>project.transaction([invalid]),/rango/);
 const invalidOffset=playerPatches(project.bytes(),0,1,{speed:3})[0];invalidOffset.offset++;assert.throws(()=>project.transaction([invalidOffset]),/permitido/);
 for(let i=0;i<42;i++){const f=readFormation(original,i);assert.equal(f.bytes.length,31);assert.ok(f.label);assert.ok(f.slots.every(s=>[1,2,3,5,6].includes(s.role)));}
 project.transaction([formationPatch(original,0,8)]);assert.deepEqual(readFormation(project.bytes(),0).bytes,readFormation(original,8).bytes);
 const numberProject=await RomProject.create(original);numberProject.transaction(playerPatches(numberProject.bytes(),0,0,{no:2}));assert.equal(new Set(readDeluxeTeam(numberProject.bytes(),0).players.map(p=>p.no)).size,20);numberProject.restore(`attributes:${0x50000}`);assert.deepEqual(numberProject.exportRom(),original);
 const edited=project.exportRom();assert.equal(word(edited,0x7fde),edited.reduce((sum,b)=>(sum+b)&65535,0));assert.equal(word(edited,0x7fdc)^word(edited,0x7fde),65535);
 const editedRanges=project.patches.map(p=>[p.offset,p.offset+p.bytes.length]);for(let i=0;i<original.length;i++)if(!editedRanges.some(([a,b])=>i>=a&&i<b)&&!(i>=0x7fdc&&i<0x7fe0))assert.equal(edited[i],original[i],`Unrelated byte ${i}`);
 const portable=JSON.parse(JSON.stringify(project.record({includeOriginal:false})));
 assert.equal(Object.hasOwn(portable,'original'),false);
 await assert.rejects(()=>RomProject.import(portable),/Abre primero la ROM original/);
 assert.deepEqual((await RomProject.import(portable,original)).exportRom(),project.exportRom());
 await assert.rejects(()=>RomProject.import({...portable,hash:'bad'},original),/hash/);
 await assert.rejects(()=>RomProject.import({...portable,original:null},original),/compatible/);
 const record=project.record(),restored=await RomProject.import(JSON.parse(JSON.stringify(record)));assert.deepEqual(restored.exportRom(),edited);const corrupt={...record,hash:'bad'};await assert.rejects(()=>RomProject.import(corrupt),/hash/);await assert.rejects(()=>RomProject.import({...record,patches:[...record.patches,record.patches[0]]}),/duplicada/);
 for(let team=0;team<42;team++)for(const resource of graphicResources(original,team)) {
   assert.deepEqual(tiles(encodeTiles(resource.matrix,resource.bpp),resource.bpp,resource.columns),resource.matrix);
   if(resource.compressed) {const bytes=encodeTiles(resource.matrix,resource.bpp),packed=compress(bytes,resource.interleaved);assert.deepEqual(decompress(packed,0),bytes);assert.ok(packed.length<=resource.capacity,`${resource.label} ${team}: ${packed.length}/${resource.capacity}`);}
 }
 const resource=graphicResources(original,0).find(r=>r.label.startsWith('Pelo 1 ')),matrix=resource.matrix.map(r=>r.slice());matrix[0][0]=(matrix[0][0]+1)%16;
 project.transaction([graphicPatch(original,resource,matrix)]);assert.deepEqual(graphicResources(project.bytes(),0).find(r=>r.id===resource.id).matrix,matrix);
 // Every country can edit both halves independently, even when the source
 // stripe pattern was shared. Exercise the loader/pointer relocation as exported.
 const flags=await RomProject.create(original),beforeFlags=Array.from({length:36},(_,i)=>flagMatrix(original,i));
 for(let team=0;team<36;team++) {
   const matrix=flagMatrix(flags.bytes(),team).map(row=>row.slice());matrix[0][0]=12+(team%4);matrix[15][23]=12+((team+1)%4);
   if(JSON.stringify(matrix)===JSON.stringify(beforeFlags[team]))matrix[0][1]=12+((team+2)%4);
   flags.transaction(flagPatches(flags.original,flags.bytes(),team,matrix));
   assert.deepEqual(flagMatrix(flags.bytes(),team),matrix);
   for(let other=team+1;other<36;other++)assert.deepEqual(flagMatrix(flags.bytes(),other),beforeFlags[other]);
 }
 assert.equal(flags.bytes()[0xe715+6],0xaf);for(let i=36;i<42;i++)assert.deepEqual(flagMatrix(flags.bytes(),i),flagMatrix(original,i));
 assert.equal(flags.bytes()[FLAG_TEMPLATE+6],0xaf);assert.equal(new Set(Array.from({length:72},(_,i)=>word(flags.bytes(),FLAG_TABLE+i*2))).size,72);
 const paletteProject=await RomProject.create(original),flagResource=graphicResources(original,0)[0],newColors=flagResource.colors.slice();newColors.splice(12,4,...imagePalette(rgba));
 paletteProject.transaction(flagPalettePatches(paletteProject.bytes(),0,newColors));assert.deepEqual(graphicResources(paletteProject.bytes(),0)[0].colors,newColors);
 for(let i=1;i<36;i++)assert.deepEqual(graphicResources(paletteProject.bytes(),i)[0].colors,graphicResources(original,i)[0].colors);
 assert.deepEqual((await RomProject.import(paletteProject.record())).exportRom(),paletteProject.exportRom());paletteProject.transaction(flagPalettePatches(paletteProject.bytes(),0,flagResource.colors));assert.deepEqual(paletteProject.exportRom(),original);
 // Follow the game's menu script into WRAM, then its country DMA table.
 const selectionRom=flags.bytes(),script=loRom(0x820000|word(selectionRom,loRom(0x87ad9a))),wram=new Uint8Array(65536);
 assert.equal(word(selectionRom,script),1);for(let entry=script+2;word(selectionRom,entry)!==65535;entry+=6){const dest=word(selectionRom,entry),address=word(selectionRom,entry+3)|(selectionRom[entry+5]<<16);assert.equal(selectionRom[entry+2],0x7f);wram.set(decompress(selectionRom,loRom(address)),dest);}
 for(let i=0;i<42;i++){const dest=word(selectionRom,loRom(0x82f829)+i*2);assert.deepEqual(tiles(wram.slice(dest,dest+192),4,3),flagMatrix(selectionRom,i));assert.ok(dest+192<=0x2280||dest>=0x3400&&dest+192<=0x3b80);}
 const previous=flags.record();previous.patches=previous.patches.filter(p=>!['flags:single-loader','flags:select-script','flags:select-entry','flags:select-map'].includes(p.id));assert.deepEqual((await RomProject.import(previous)).exportRom(),flags.exportRom());
 const restoredFlags=await RomProject.import(flags.record());assert.deepEqual(restoredFlags.exportRom(),flags.exportRom());
 const oldRecord=flags.record();oldRecord.patches=oldRecord.patches.filter(p=>['flags:pool','flags:pointers','flags:loader'].includes(p.id)).map(p=>({...p,bytes:Buffer.from(p.bytes,'base64').subarray(0,p.id==='flags:pool'?7344:p.id==='flags:pointers'?144:Infinity).toString('base64')}));const upgraded=await RomProject.import(oldRecord);assert.deepEqual(upgraded.exportRom(),flags.exportRom());
 const reopen=await RomProject.create(flags.exportRom()),reedit=flagMatrix(reopen.bytes(),0).map(r=>r.slice());reedit[7][12]=13;reopen.transaction(flagPatches(reopen.original,reopen.bytes(),0,reedit));assert.deepEqual(flagMatrix(reopen.bytes(),0),reedit);
 const badLoader=flags.patches.find(p=>p.id==='flags:loader');badLoader.bytes[6]=0x90;assert.throws(()=>flags.transaction([badLoader]),/Banco|cargador/i);
 for(let team=0;team<36;team++)flags.transaction(flagPatches(flags.original,flags.bytes(),team,beforeFlags[team]));assert.deepEqual(flags.exportRom(),original);
 const labels=await RomProject.create(original),randomLabel=Array.from({length:8},(_,y)=>Array.from({length:32},(_,x)=>(x*17+y*13+(x*y)%7)%4));
 labels.transaction(smallLabelPatches(original,labels.bytes(),0,randomLabel));assert.deepEqual(smallLabelMatrix(labels.bytes(),0),randomLabel);assert.equal(labels.bytes()[LABEL_TEMPLATE+6],0xaf);
 for(let i=1;i<42;i++)assert.deepEqual(smallLabelMatrix(labels.bytes(),i),smallLabelMatrix(original,i));
 const labelRom=labels.bytes();for(let i=0;i<42;i++){const entry=loRom(0x828f21)+2+i*6;assert.equal(word(labelRom,entry),i*64);assert.equal(labelRom[entry+2],0x7f);assert.deepEqual(tiles(decompress(labelRom,loRom(word(labelRom,entry+3)|labelRom[entry+5]<<16)),2,4),smallLabelMatrix(labelRom,i));}
 const priorLabels=labels.record();priorLabels.patches=priorLabels.patches.filter(p=>p.id!=='labels:select-loader');assert.deepEqual((await RomProject.import(priorLabels)).exportRom(),labels.exportRom());
 assert.deepEqual((await RomProject.import(labels.record())).exportRom(),labels.exportRom());
 const reopenedLabels=await RomProject.create(labels.exportRom());assert.deepEqual(smallLabelMatrix(reopenedLabels.bytes(),0),randomLabel);
 labels.transaction(smallLabelPatches(original,labels.bytes(),0,smallLabelMatrix(original,0)));assert.deepEqual(labels.exportRom(),original);
 const sprites=await RomProject.create(original);
 for(const resource of graphicResources(original,0).filter(r=>r.kind==='sprite'&&!r.global)) {
   assert.equal(resource.matrix.length,48);assert.equal(resource.matrix[0].length,resource.label.startsWith('Portero')?24:32);
   sprites.transaction(graphicPatches(original,sprites.bytes(),resource,resource.matrix));assert.deepEqual(sprites.exportRom(),original);
   const matrix=resource.matrix.map(row=>row.slice());let done=false;
   for(let y=0;y<matrix.length&&!done;y++)for(let x=0;x<matrix[0].length&&!done;x++)if(matrix[y][x]&&resource.editable[y][x]){matrix[y][x]=matrix[y][x]%15+1;done=true;}
   sprites.transaction(graphicPatches(original,sprites.bytes(),resource,matrix));assert.notDeepEqual(graphicResources(sprites.bytes(),0).find(r=>r.id===resource.id).matrix,resource.matrix);
   sprites.transaction(resource.parts.flatMap((p,i)=>resource.editableParts.includes(i)?sprites.restorePatches(p.id):[]));assert.deepEqual(sprites.exportRom(),original);
 }
 // The two title notices get independent tiles; reused letters and PRESS START survive.
 const {TITLE_LEGAL_RULES,validateTitleLegal}=await import('../src/rom/title-legal.mjs');
 const notices=await RomProject.create(original),getNotices=rom=>graphicResources(rom,0).filter(r=>r.kind==='title-legal');
 const nativeNotices=getNotices(original);assert.deepEqual(nativeNotices.map(r=>[r.id,r.matrix[0].length,r.matrix.length]),[['title-copyright',240,8],['title-license',160,8]]);
 const draw=(width,seed)=>Array.from({length:8},(_,y)=>Array.from({length:width},(_,x)=>(x*3+y*7+seed)%16));
 const copyrightDraw=draw(240,1),licenseDraw=draw(160,2);
 notices.transaction(graphicPatches(original,notices.bytes(),getNotices(notices.bytes())[0],copyrightDraw));
 assert.deepEqual(getNotices(notices.bytes())[0].matrix,copyrightDraw);assert.deepEqual(getNotices(notices.bytes())[1].matrix,nativeNotices[1].matrix);
 notices.transaction(graphicPatches(original,notices.bytes(),getNotices(notices.bytes())[1],licenseDraw));
 assert.deepEqual(getNotices(notices.bytes()).map(r=>r.matrix),[copyrightDraw,licenseDraw]);
 validateTitleLegal(notices.bytes(),original);
 const legalData=decompress(notices.bytes(),TITLE_LEGAL_RULES[0][1]);
 assert.deepEqual(legalData.slice(5504,6496),decompress(original,loRom(0xa7e154)));
 // The large sprites' bottom halves must be transparent (including both Nintendo sprites).
 for(const t of [44,45,64,65,66,67])assert.ok(legalData.slice(t*32,(t+1)*32).every(b=>b===0));
 for(const [address,dest] of [[0xaa9a24,0x7000],[0xaa9c51,0x7300]])assert.ok(dest+decompress(original,loRom(address)).length/2<=0x7340);
 // Follow the title DMA script and render using the game's small/large sprite anchors.
 const titleVram=new Uint8Array(65536),noticeRom=notices.bytes();
 for(let entry=loRom(0x829989);noticeRom[entry]!==255;entry+=5){const dest=word(noticeRom,entry),address=word(noticeRom,entry+2)|(noticeRom[entry+4]<<16);titleVram.set(decompress(noticeRom,loRom(address)),dest*2);}
 const hardwareNotice=(address,left,y,width)=>{
   const strip=tiles(titleVram,4,1),matrix=Array.from({length:16},()=>Array(width).fill(0)),map=loRom(address);
   for(let i=noticeRom[map]-1;i>=0;i--){const [sy,sx,tile,attr]=noticeRom.slice(map+1+i*4,map+5+i*4),large=!!(attr&16),size=large?16:8;
     const x=(sx>127?sx-256:sx)-left-(large?4:0),top=sy-y-(large?4:0),base=0x6000/16+(attr&1?256:0);
     for(let py=0;py<size;py++)for(let px=0;px<size;px++){const xx=x+px,yy=top+py;if(xx<0||xx>=width||yy<0||yy>=16)continue;
       const t=base+(tile&240)+((tile+Math.floor(px/8))&15)+Math.floor(py/8)*16,pixel=strip[t*8+py%8][px%8];if(pixel)matrix[yy][xx]=pixel;
     }
   }return matrix;
 };
 const assertHardwareNotices=()=>{for(const [address,left,y,width,image] of [[0x88ee12,-110,81,240,copyrightDraw],[0x88ee87,-75,90,160,licenseDraw]]){const rendered=hardwareNotice(address,left,y,width);assert.deepEqual(rendered.slice(0,8),image);assert.ok(rendered.slice(8).flat().every(p=>p===0));}};
 assertHardwareNotices();
 // The exploding logo streams three independent 32-tile chunks during animation.
 for(const [i,dest] of [0x7800,0x7a00,0x7c00].entries())titleVram.set(decompress(original,loRom([0xa9c1d5,0xa9c282,0xa9c327][i])),dest*2);
 assertHardwareNotices();
 const legalExport=notices.exportRom();assert.deepEqual(getNotices((await RomProject.create(legalExport)).bytes()).map(r=>r.matrix),[copyrightDraw,licenseDraw]);
 assert.deepEqual((await RomProject.import(notices.record())).exportRom(),legalExport);
 // Upgrade earlier saved projects and exported ROMs without changing their artwork.
 const legacyRom=notices.bytes(),legacyAtlas=new Uint8Array(4096);
 legacyAtlas.set(encodeTiles(copyrightDraw,4),0);legacyAtlas.set(encodeTiles(licenseDraw,4),56*32);legacyAtlas.set(decompress(original,loRom(0xa7e154)),3072);
 const [atlasRule,loaderRule,...mapRules]=TITLE_LEGAL_RULES;legacyRom.fill(255,atlasRule[1],atlasRule[1]+atlasRule[2]);legacyRom.set(compress(legacyAtlas),atlasRule[1]);legacyRom.set([0,0x78,0,0xf0,0xaf],loaderRule[1]);
 mapRules.forEach(([,offset],line)=>{let x=0;const width=line?160:240,count=line?18:29;legacyRom[offset]=count;for(let i=0;i<count;i++){const large=i>=count*2-width/8;legacyRom.set([line?90:81,((line?-75:-110)+x)&255,(line?184:128)+x/8,large?23:7],offset+1+i*4);x+=large?16:8;}});
 validateTitleLegal(legacyRom,original);
 const legacyRecord=notices.record();legacyRecord.patches=legacyRecord.patches.map(p=>{const rule=TITLE_LEGAL_RULES.find(([id])=>id===p.id);return rule?{...p,bytes:Buffer.from(legacyRom.slice(rule[1],rule[1]+rule[2])).toString('base64')}:p;});
 for(const repaired of [await RomProject.import(legacyRecord),await RomProject.create(legacyRom)]){assert.equal(word(repaired.bytes(),loaderRule[1]),0x7340);assert.deepEqual(getNotices(repaired.bytes()).map(r=>r.matrix),[copyrightDraw,licenseDraw]);assert.equal(repaired.canUndo,false);validateTitleLegal(repaired.bytes(),repaired.original);if(word(repaired.original,loaderRule[1])===0x7800){repaired.restore('title-legal:atlas');assert.equal(word(repaired.bytes(),loaderRule[1]),0x7340);}}
 notices.undo();assert.deepEqual(getNotices(notices.bytes())[1].matrix,nativeNotices[1].matrix);notices.redo();
 const corruptLegal=notices.patches.find(p=>p.id==='title-legal:loader');corruptLegal.bytes[0]^=1;assert.throws(()=>notices.transaction([corruptLegal]),/portada/);
 notices.transaction(graphicPatches(original,notices.bytes(),getNotices(notices.bytes())[0],nativeNotices[0].matrix));assert.deepEqual(getNotices(notices.bytes())[1].matrix,licenseDraw);
 notices.transaction(graphicPatches(original,notices.bytes(),getNotices(notices.bytes())[1],nativeNotices[1].matrix));assert.deepEqual(notices.exportRom(),original);
 notices.transaction(graphicPatches(original,notices.bytes(),getNotices(notices.bytes())[0],copyrightDraw));notices.restore('title-legal:atlas');assert.deepEqual(notices.exportRom(),original);
 const occupied=original.slice();occupied[TITLE_LEGAL_RULES[0][1]]=0;assert.throws(()=>graphicPatches(occupied,occupied,getNotices(occupied)[0],copyrightDraw),/ocupado/);
 assert.throws(()=>graphicPatches(original,original,nativeNotices[0],[[]]),/resolución/);
 // Typed notices survive independent edits, history, project recovery and ROM reopening.
 const {previewTitleLegalText,titleLegalTextPatches,titleLegalTexts}=await import('../src/rom/title-legal.mjs');
 const typedNotices=await RomProject.create(original),copyrightText='© 2026 KONAMI - ALL RIGHTS RESERVED.',licenseText='LICENSED BY CODEX';
 assert.equal(titleLegalTexts(original)[1],'LICENSED BY NINTENDO');
 const typedCopyright=previewTitleLegalText(original,'title-copyright',copyrightText);
 assert.ok(typedCopyright.matrix.flat().some(Boolean));
 typedNotices.transaction(titleLegalTextPatches(original,typedNotices.bytes(),'title-copyright',copyrightText.toLowerCase()));
 assert.deepEqual(titleLegalTexts(typedNotices.bytes()),[copyrightText,'LICENSED BY NINTENDO']);
 assert.deepEqual(getNotices(typedNotices.bytes())[0].matrix,typedCopyright.matrix);
 assert.deepEqual(getNotices(typedNotices.bytes())[1].matrix,nativeNotices[1].matrix);
 typedNotices.transaction(titleLegalTextPatches(original,typedNotices.bytes(),'title-license',licenseText));
 assert.deepEqual(titleLegalTexts(typedNotices.bytes()),[copyrightText,licenseText]);
 typedNotices.undo();assert.equal(titleLegalTexts(typedNotices.bytes())[1],'LICENSED BY NINTENDO');typedNotices.redo();
 const reopenedTyped=await RomProject.create(typedNotices.exportRom());
 assert.deepEqual(titleLegalTexts(reopenedTyped.bytes()),[copyrightText,licenseText]);
 assert.deepEqual(titleLegalTexts((await RomProject.import(typedNotices.record())).bytes()),[copyrightText,licenseText]);
 typedNotices.transaction(graphicPatches(original,typedNotices.bytes(),getNotices(typedNotices.bytes())[1],licenseDraw));
 assert.deepEqual(titleLegalTexts(typedNotices.bytes()),[copyrightText,'']);
 typedNotices.transaction(graphicPatches(original,typedNotices.bytes(),getNotices(typedNotices.bytes())[1],nativeNotices[1].matrix));
 assert.equal(titleLegalTexts(typedNotices.bytes())[1],'LICENSED BY NINTENDO');
 typedNotices.transaction(graphicPatches(original,typedNotices.bytes(),getNotices(typedNotices.bytes())[0],nativeNotices[0].matrix));
 assert.deepEqual(typedNotices.exportRom(),original);
 assert.throws(()=>previewTitleLegalText(original,'title-license','A'.repeat(27)),/hasta 26/);
 assert.throws(()=>previewTitleLegalText(original,'title-copyright','Ñ'),/A–Z/);
 for(const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-©')assert.ok(previewTitleLegalText(original,'title-license',c).matrix.flat().some(Boolean),c);
 // Supplemental glyphs must use the same row colors as the native font.
 const nativeGradient=previewTitleLegalText(original,'title-license','K').matrix.map(row=>row.find(Boolean)||0);
 assert.ok(new Set(nativeGradient.filter(Boolean)).size>1);
 for(const id of ['title-copyright','title-license']){
   for(const c of 'FJPQUWXZ0234678-'){
     const preview=previewTitleLegalText(original,id,c);
     preview.matrix.forEach((row,y)=>{for(const pixel of row)if(pixel)assert.equal(pixel,nativeGradient[y],`${id} ${c} row ${y}`);});
   }
   const gradientNotices=await RomProject.create(original),text='FJPQUWXZ 0234678';
   gradientNotices.transaction(titleLegalTextPatches(original,gradientNotices.bytes(),id,text));
   const reopened=await RomProject.create(gradientNotices.exportRom());
   assert.deepEqual(getNotices(reopened.bytes()).find(r=>r.id===id).matrix,previewTitleLegalText(original,id,text).matrix);
   // Previously exported monochrome supplemental letters remain readable.
   const flatMatrix=previewTitleLegalText(original,id,'FJPQUWXZ').matrix.map(row=>row.map(pixel=>pixel?nativeGradient[0]:0));
   const legacyTyped=await RomProject.create(original);
   legacyTyped.transaction((await import('../src/rom/title-legal.mjs')).titleLegalPatches(original,legacyTyped.bytes(),id,flatMatrix,'FJPQUWXZ'));
   assert.deepEqual(getNotices((await RomProject.create(legacyTyped.exportRom())).bytes()).find(r=>r.id===id).matrix,flatMatrix);
 }
 typedNotices.transaction(titleLegalTextPatches(original,typedNotices.bytes(),'title-license',''));
 assert.ok(getNotices(typedNotices.bytes())[1].matrix.flat().every(p=>p===0));
 const {renameTeamPatches,restoreTeamLabelPatches,bigLabel,labelLayout,labelFrame,compactTeamName,frameText,bigTeamNamePatches,smallTeamNamePatches,teamNameTexts}=await import('../src/rom/team-labels.mjs');
 // HOLANDA fits the sprite slot; equivalent OAM order must fit the byte budget.
 const holland=await RomProject.create(original),beforeHolland=Array.from({length:42},(_,i)=>bigLabel(original,i).matrix);
 holland.transaction(bigTeamNamePatches(original,holland.bytes(),1,'HOLANDA'));
 assert.equal(frameText(holland.bytes(),1),'HOLANDA');
 const holandaImage=bigLabel(holland.bytes(),1).matrix;
 assert.deepEqual(holandaImage,(await import('../src/rom/team-labels.mjs')).previewBigTeamText(original,'HOLANDA').matrix);
 assert.deepEqual(smallLabelMatrix(holland.bytes(),1),smallLabelMatrix(original,1));
 for(let other=0;other<42;other++)if(other!==1)assert.deepEqual(bigLabel(holland.bytes(),other).matrix,beforeHolland[other]);
 const reopenedHolland=await RomProject.create(holland.exportRom());assert.equal(frameText(reopenedHolland.bytes(),1),'HOLANDA');assert.deepEqual(bigLabel(reopenedHolland.bytes(),1).matrix,holandaImage);
 assert.deepEqual((await RomProject.import(holland.record())).exportRom(),holland.exportRom());
 holland.transaction(restoreTeamLabelPatches(original,holland.bytes(),1));assert.deepEqual(holland.exportRom(),original);
 // N. Ireland punctuation and Czech's bank-1 font/frame must survive export.
 assert.equal(labelFrame(labelLayout(original),22).frame,28);
 assert.equal(frameText(original,21),'N. IRELAND');assert.equal(frameText(original,22),'THE CZECH REP.');
 assert.equal(bigLabel(original,21).maxLetters,10);assert.equal(bigLabel(original,22).maxLetters,14);
 const czechFont=tiles(decompress(original,loRom(0x9ba400)),4,16),czechImage=bigLabel(original,22).matrix;
 for(let y=0;y<16;y++)assert.deepEqual(czechImage[y+4].slice(23,39),czechFont[y].slice(72,88));
 for(const [team,name] of [[21,'N. IRELAND'],[22,'CZECH REP.'],[21,'N.IRELAND']]){
   const labels=await RomProject.create(original),beforeNames=Array.from({length:36},(_,i)=>bigLabel(original,i).matrix);
   labels.transaction(renameTeamPatches(original,labels.bytes(),team,name));assert.equal(frameText(labels.bytes(),team),name);
   assert.deepEqual(smallLabelMatrix(labels.bytes(),team),compactTeamName(original,name));
   for(let other=0;other<36;other++)if(other!==team)assert.deepEqual(bigLabel(labels.bytes(),other).matrix,beforeNames[other]);
   const reopened=await RomProject.create(labels.exportRom());assert.equal(bigLabel(reopened.bytes(),team).maxLetters,team===22?14:10);assert.equal(frameText(reopened.bytes(),team),name);
   assert.deepEqual((await RomProject.import(labels.record())).exportRom(),labels.exportRom());
   labels.transaction(restoreTeamLabelPatches(original,labels.bytes(),team));assert.deepEqual(labels.exportRom(),original);
 }
 assert.throws(()=>renameTeamPatches(original,original,21,'ABCDEFGHIJK'),/hasta 10/);
 const independent=await RomProject.create(original),nativeCzechRed=bigLabel(original,22).matrix;
 assert.deepEqual(teamNameTexts(original,original,22),{small:'CZECH',large:'THE CZECH REP.'});
 independent.transaction(smallTeamNamePatches(original,independent.bytes(),22,'CHILE'));
 assert.deepEqual(bigLabel(independent.bytes(),22).matrix,nativeCzechRed);assert.equal(teamNameTexts(original,independent.bytes(),22).small,'CHILE');
 const smallChile=smallLabelMatrix(independent.bytes(),22),americanTitle=bigLabel(original,41).matrix;
 independent.transaction(bigTeamNamePatches(original,independent.bytes(),22,'THE CZECH REP'));
 assert.equal(frameText(independent.bytes(),22),'THE CZECH REP');assert.deepEqual(smallLabelMatrix(independent.bytes(),22),smallChile);
 assert.deepEqual(bigLabel(independent.bytes(),41).matrix,americanTitle);
 independent.transaction(bigTeamNamePatches(original,independent.bytes(),22,'CZECH REP.'));assert.deepEqual(smallLabelMatrix(independent.bytes(),22),smallChile);
 assert.deepEqual(teamNameTexts(original,(await RomProject.import(independent.record())).bytes(),22),{small:'CHILE',large:'CZECH REP.'});
 independent.transaction(restoreTeamLabelPatches(original,independent.bytes(),22));assert.deepEqual(independent.exportRom(),original);
 for(let team=36;team<42;team++){
   const star=await RomProject.create(original),source=readDeluxeTeam(original,team);assert.equal(source.players.length,20);assert.ok(source.players.every(p=>!p.name.includes('�')));
   star.transaction(playerPatches(star.bytes(),team,0,{speed:4}));assert.equal(readDeluxeTeam(star.bytes(),team).players[0].speed,4);
   assert.deepEqual(readDeluxeTeam(star.bytes(),0).players,readDeluxeTeam(original,0).players);
   const flag=flagMatrix(star.bytes(),team).map(row=>row.slice());flag[0][0]=flag[0][0]===12?13:12;
   star.transaction(flagPatches(original,star.bytes(),team,flag));assert.deepEqual(flagMatrix(star.bytes(),team),flag);
   for(let other=0;other<42;other++)if(other!==team)assert.deepEqual(flagMatrix(star.bytes(),other),flagMatrix(original,other));
   star.transaction(smallTeamNamePatches(original,star.bytes(),team,'STARS'));assert.deepEqual(smallLabelMatrix(star.bytes(),team),compactTeamName(original,'STARS'));
   assert.deepEqual((await RomProject.import(star.record())).exportRom(),star.exportRom());
   assert.equal(bigLabel(star.bytes(),team).matrix.length,24);assert.ok(teamNameTexts(original,star.bytes(),team).large);
 }
 const argentina=await RomProject.create(original);assert.equal(bigLabel(original,31).maxLetters,9);assert.equal(frameText(original,31),'ARGENTINA');
 const originalArgentina=bigLabel(original,31).matrix;assert.equal(Math.min(...originalArgentina.flatMap((row,y)=>row.slice(5,36).some(p=>p===9||p===10)?[y]:[])),4);
 argentina.transaction(renameTeamPatches(original,argentina.bytes(),31,'ARGENTINO'));assert.equal(frameText(argentina.bytes(),31),'ARGENTINO');assert.deepEqual((await RomProject.import(argentina.record())).exportRom(),argentina.exportRom());
 for(let i=0;i<36;i++)if(i!==31)assert.deepEqual(bigLabel(argentina.bytes(),i).matrix,bigLabel(original,i).matrix);
 argentina.transaction(restoreTeamLabelPatches(original,argentina.bytes(),31));assert.deepEqual(argentina.exportRom(),original);
 const named=await RomProject.create(original),otherNames=Array.from({length:36},(_,i)=>bigLabel(original,i).matrix);
 const chile=compactTeamName(original,'CHILE');assert.ok(chile.flat().includes(3),'Generated compact names retain a black outline');assert.deepEqual(chile.slice(0,7).map(row=>row.slice(11,14).map(p=>p===3?0:p)),smallLabelMatrix(original,1).slice(0,7).map(row=>row.slice(2,5).map(p=>p===3?0:p)));
 named.transaction(renameTeamPatches(named.original,named.bytes(),0,'CHILE'));assert.notDeepEqual(bigLabel(named.bytes(),0).matrix,otherNames[0]);assert.deepEqual(smallLabelMatrix(named.bytes(),0),chile);
 for(let i=1;i<36;i++)assert.deepEqual(bigLabel(named.bytes(),i).matrix,otherNames[i]);
 assert.throws(()=>renameTeamPatches(named.original,named.bytes(),0,'TOOLONG'),/admite/);
 const fonts=loRom(0x9de13c);assert.deepEqual(named.bytes().slice(fonts,fonts+word(original,fonts)),original.slice(fonts,fonts+word(original,fonts)));
 named.transaction(restoreTeamLabelPatches(named.original,named.bytes(),0));assert.deepEqual(named.exportRom(),original);
 const logoProject=await RomProject.create(original),logo=graphicResources(original,0).find(r=>r.kind==='composite');
 assert.equal(logo.matrix[0].length,256);assert.equal(logo.matrix.length,128);assert.equal(logo.colors.length,48);
 logoProject.transaction(graphicPatches(original,original,logo,logo.matrix));assert.deepEqual(logoProject.exportRom(),original);
 for(let part=0;part<2;part++) {
   const current=graphicResources(logoProject.bytes(),0).find(r=>r.kind==='composite'),matrix=current.matrix.map(row=>row.slice());let done=false;
   for(let y=0;y<matrix.length&&!done;y++)for(let x=0;x<matrix[0].length&&!done;x++){
     const owner=current.owners[y][x];if(!owner||owner.part!==part||matrix[y][x]===0)continue;
     matrix[y][x]=owner.paletteBase+matrix[y][x]%15+1;done=true;
   }
   const beforeOther=Uint8Array.from(logoProject.bytes().subarray(current.parts[1-part].offset,current.parts[1-part].offset+current.parts[1-part].capacity));
   logoProject.transaction(graphicPatches(original,logoProject.bytes(),current,matrix));assert.notDeepEqual(graphicResources(logoProject.bytes(),0).find(r=>r.kind==='composite').matrix,current.matrix);
   assert.deepEqual(logoProject.bytes().slice(current.parts[1-part].offset,current.parts[1-part].offset+current.parts[1-part].capacity),beforeOther);
 }
 logoProject.transaction(logo.parts.flatMap(p=>logoProject.restorePatches(p.id)));assert.deepEqual(logoProject.exportRom(),original);
 const photosProject=await RomProject.create(original),photos=graphicResources(original,0).filter(r=>r.kind==='portrait');
 assert.equal(photos.length,5);assert.deepEqual(photos.map(r=>[r.matrix[0].length,r.matrix.length]),[[48,80],[48,64],[48,80],[48,72],[48,80]]);
 assert.equal(photos[0].colors[32],'#ffffff');
 for(const photo of photos) {
   photosProject.transaction(graphicPatches(original,photosProject.bytes(),photo,photo.matrix));
   assert.deepEqual(photosProject.exportRom(),original);
 }
 for(const photo of photos) {
   const current=graphicResources(photosProject.bytes(),0).find(r=>r.id===photo.id),matrix=current.matrix.map(row=>row.slice());
   let done=false;for(let y=0;y<matrix.length&&!done;y++)for(let x=0;x<matrix[0].length&&!done;x++){
     if(!current.owners[y][x]||matrix[y][x]===0)continue;
     matrix[y][x]=matrix[y][x]===32?33:32;done=true;
   }
   const before=graphicResources(photosProject.bytes(),0).filter(r=>r.kind==='portrait');
   photosProject.transaction(graphicPatches(original,photosProject.bytes(),current,matrix));
   const after=graphicResources(photosProject.bytes(),0).filter(r=>r.kind==='portrait');
   assert.notDeepEqual(after.find(r=>r.id===photo.id).matrix,photo.matrix);
   for(const other of before.filter(r=>r.id!==photo.id))assert.deepEqual(after.find(r=>r.id===other.id).matrix,other.matrix);
   assert.throws(()=>graphicPatches(original,original,photo,photo.matrix.map(row=>row.map(()=>1))),/paleta/);
 }
 const photosImported=await RomProject.import(JSON.parse(JSON.stringify(photosProject.record())));
 assert.deepEqual(photosImported.exportRom(),photosProject.exportRom());
 photosProject.undo();photosProject.redo();assert.deepEqual(photosProject.exportRom(),photosImported.exportRom());
 for(const photo of photos){const current=graphicResources(photosProject.bytes(),0).find(r=>r.id===photo.id);photosProject.transaction(graphicPatches(original,photosProject.bytes(),current,photo.matrix));}
 assert.deepEqual(photosProject.exportRom(),original);
 const legacy=await RomProject.create(original),legacyOffset=loRom(0x98c5d4),legacyBytes=original.slice(legacyOffset,legacyOffset+8192);legacyBytes[300]^=1;
 legacy.transaction([{id:`graphic:${legacyOffset}`,offset:legacyOffset,bytes:legacyBytes}]);
 const detail=graphicResources(legacy.bytes(),0).find(r=>r.editableParts?.length===1),detailMatrix=detail.matrix.map(row=>row.slice());let painted=false;
 for(let y=0;y<detailMatrix.length&&!painted;y++)for(let x=0;x<detailMatrix[0].length&&!painted;x++)if(detail.editable[y][x]){detailMatrix[y][x]=detailMatrix[y][x]%15+1;painted=true;}
 legacy.transaction(graphicPatches(original,legacy.bytes(),detail,detailMatrix));assert.equal(legacy.patches.length,1);assert.equal(legacy.patches[0].id,`graphic:${legacyOffset}`);
 legacy.restore(`graphic:${legacyOffset}`);assert.deepEqual(legacy.exportRom(),original);
 const paletteOffset=loRom(0x890000|word(original,0x1027a))+2+8;project.transaction([{id:`palette:${paletteOffset}`,offset:paletteOffset,label:'Piel',bytes:rgb555('#ff0000')}]);assert.equal(readDeluxeTeam(project.bytes(),0).players[1].skinColor,'#ff0000');
 const eligible=AUDIO_SAMPLES.filter(s=>!audioRegion(original,s).reason);assert.ok(eligible.length);const sample=eligible[0],region=audioRegion(original,sample),replacement=replacementAudio(original,sample,{samples:input,sampleRate:12000},1300);project.transaction([replacement.patch]);assert.equal(project.bytes()[region.offset],replacement.patch.bytes[0]);
 const titleSample=AUDIO_SAMPLES.find(s=>s.name==='TitleScreenNameDrop'),titleRegion=audioRegion(original,titleSample);
 assert.equal(titleRegion.reason,'');assert.equal(titleRegion.segmented,true);
 const titleReplacement=replacementAudio(original,titleSample,{samples:Int16Array.from({length:titleRegion.capacity/9*16},(_,i)=>Math.round(Math.sin(i/20)*10000)),sampleRate:pitchRate(1300)},1300);
 assert.equal(titleReplacement.samples.length,40544);
 for(let i=0;i<titleRegion.capacity;i+=9)assert.equal(titleReplacement.patch.bytes[i]&3,titleRegion.bytes[i]&3);
 const titleProject=await RomProject.create(original);titleProject.transaction([titleReplacement.patch]);
 const normalizedTitle=normalizedAudioPatches(titleProject.bytes(),titleProject.patches);assert.equal(normalizedTitle.length,1);
 for(let i=0;i<titleRegion.capacity;i+=9)assert.equal(normalizedTitle[0].bytes[i]&3,titleRegion.bytes[i]&3);
 titleProject.transaction(normalizedTitle);titleProject.undo();assert.deepEqual(titleProject.patches[0].bytes,titleReplacement.patch.bytes);
 const quietProject=await RomProject.create(original),quietSamples=eligible.filter(s=>!audioRegion(original,s).segmented).slice(0,2);
 quietProject.transaction(quietSamples.map((s,i)=>{const r=audioRegion(original,s);return {id:`audio:${r.offset}`,offset:r.offset,bytes:encodeBrr(Int16Array.from({length:160},(_,n)=>(n%2?1:-1)*(i+1)*200),r.capacity)};}));
 const quietBefore=quietProject.exportRom(),normalizedBatch=normalizedAudioPatches(quietProject.bytes(),quietProject.patches);assert.equal(normalizedBatch.length,2);
 for(const patch of normalizedBatch){const decoded=decodeBrr(patch.bytes);assert.ok(Math.abs(rms(decoded.slice(0,160))-8192)<300);assert.ok(decoded.slice(160).every(v=>v===0));}
 quietProject.transaction(normalizedBatch);assert.deepEqual((await RomProject.import(quietProject.record())).exportRom(),quietProject.exportRom());quietProject.undo();assert.deepEqual(quietProject.exportRom(),quietBefore);quietProject.redo();assert.deepEqual(quietProject.patches.map(p=>p.bytes),normalizedBatch.map(p=>p.bytes));assert.deepEqual(normalizedAudioPatches(original,[]),[]);
 assert.deepEqual((await RomProject.import(titleProject.record())).exportRom(),titleProject.exportRom());
 const badTitle={...titleReplacement.patch,bytes:titleReplacement.patch.bytes.slice()};badTitle.bytes[199*9]^=1;
 assert.throws(()=>titleProject.transaction([badTitle]),/Marcas BRR/);
 // Loader's length word, SPC directory and neighboring music stay unchanged.
 assert.deepEqual(titleProject.bytes().slice(0,titleRegion.offset),original.slice(0,titleRegion.offset));
 assert.deepEqual(titleProject.bytes().slice(titleRegion.offset+titleRegion.capacity),original.slice(titleRegion.offset+titleRegion.capacity));
 titleProject.restore(titleReplacement.patch.id);assert.deepEqual(titleProject.exportRom(),original);
 assert.throws(()=>replacementAudio(original,AUDIO_SAMPLES.find(s=>s.name==='UnknownIntroSample'),{samples:input,sampleRate:12000},1300),/fragmentos/);

 const importedFloat=parseWav(makeWav(3,32,Array.from({length:96000},(_,i)=>Math.sin(i/20)*.5)));
 const maximum=region.capacity/9*16/pitchRate(1300),safeLength=Math.floor(maximum*importedFloat.sampleRate)/importedFloat.sampleRate;
 const fitted=replacementAudio(original,sample,trimAudio(importedFloat,.25,.25+safeLength),1300),audioProject=await RomProject.create(original);
 assert.equal(fitted.patch.bytes.length,region.capacity);assert.equal(fitted.samples.length,region.capacity/9*16);assert.ok(fitted.samples.some(Boolean));audioProject.transaction([fitted.patch]);
 assert.deepEqual((await RomProject.import(audioProject.record())).exportRom(),audioProject.exportRom());audioProject.restore(fitted.patch.id);assert.deepEqual(audioProject.exportRom(),original);
 smc.transaction(playerPatches(smc.bytes(),0,0,{name:'Test'}));assert.deepEqual(smc.exportRom().slice(0,512),headered.slice(0,512));
 for(let i=0;i<36;i++)assert.equal(readDeluxeTeam(project.exportRom(),i).players.length,20);
 project.reset();assert.deepEqual(project.exportRom(),original);
 console.log(`PASS editor: tiles/compression, ${42} team graphic round-trips, players, immutable ROM, SHA-256 project recovery, checksum, SMC header, BRR/WAV and ${eligible.length} replaceable samples`);
})().catch(e=>{console.error(e);process.exitCode=1;});
