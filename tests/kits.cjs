const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
global.crypto ||= require('node:crypto').webcrypto;
(async()=>{
 const {RomProject}=await import('../src/rom/project.mjs'),{graphicPatches}=await import('../src/rom/graphics.mjs'),{kitSections,kitDrawingResource,kitDrawingMask,normalizeKitDrawing,kitToneColors}=await import('../src/rom/kits.mjs'),{teamPhotoResource,photoColorIndex,normalizePhotoDrawing}=await import('../src/rom/team-photo.mjs'),{teamPointer,teamPaletteOffset}=await import('../src/rom/team-count.mjs'),{word}=await import('../src/rom/binary.mjs');
 const original=new Uint8Array(fs.readFileSync(path.join(__dirname,'../roms/International Superstar Soccer Deluxe (USA).sfc'))),project=await RomProject.create(original);
 for(const table of [0x1027a,0x102d0,0x10326])for(let direction=0;direction<8;direction++){
  const resource=kitDrawingResource(original,0,table,direction),mask=kitDrawingMask(resource,'shirt',table===0x10326),matrix=resource.matrix.map(row=>row.slice());let edited=false;
  matrix.forEach((row,y)=>row.forEach((pixel,x)=>{if(mask[y][x]){assert.ok([7,8,9].includes(pixel));row[x]=pixel===7?9:7;edited=true;}}));assert.ok(edited);const normalized=normalizeKitDrawing(resource,matrix,resource.matrix);
  project.transaction(graphicPatches(project.original,project.bytes(),resource,normalized));assert.notDeepEqual(project.bytes(),original);project.undo();assert.deepEqual(project.bytes(),original);
 }
 assert.deepEqual(kitSections(original,0,0x1027a).find(p=>p.label==='Pantalón').colors.map(c=>c.index),[10,11,12]);
 for(let team=0;team<42;team++){const photo=teamPhotoResource(original,team);assert.ok(photo.matrix.flat().filter(Boolean).length>1000);assert.ok(photo.owners.flat().some(Boolean));project.transaction(graphicPatches(original,original,photo,photo.matrix));assert.deepEqual(project.exportRom(),original);}
 const photo=teamPhotoResource(original,30),uses=new Map();photo.owners.forEach((row,y)=>row.forEach((o,x)=>{if(!o)return;const key=`${o.part}:${o.x}:${o.y}`;if(!uses.has(key))uses.set(key,[]);uses.get(key).push({x,y});}));const repeated=[...uses.values()].find(points=>points.length>1),point=repeated[0],owner=photo.owners[point.y][point.x],ink=owner.paletteBase+(photo.matrix[point.y][point.x]%16===1?2:1),stroke=photo.matrix.map(row=>row.slice());stroke[point.y][point.x]=ink;const normalized=normalizePhotoDrawing(photo,stroke,photo.matrix);for(const p of repeated)assert.equal(normalized[p.y][p.x]%16,ink%16);assert.equal(photoColorIndex(photo,point,ink),ink);assert.equal(photoColorIndex(photo,point,0),0);
 const before=original.slice();project.setTeamColor(0,0x1027a,7,'#ff0000');assert.equal(word(project.bytes(),teamPaletteOffset(project.bytes(),teamPointer(project.bytes(),0x1027a,0))+16),31);assert.deepEqual(original,before);project.undo();
 project.setTeamColor(30,0x103d2,0,'#e629c5');assert.equal(project.bytes().length,0x400000);const ownNative=teamPaletteOffset(project.bytes(),teamPointer(project.bytes(),0x103d2,30))+2,otherNative=teamPaletteOffset(project.bytes(),teamPointer(project.bytes(),0x103d2,31))+2;assert.notEqual(ownNative,otherNative);assert.equal(word(project.bytes(),otherNative),word(original,teamPaletteOffset(original,teamPointer(original,0x103d2,31))+2));project.restore(`palette:${ownNative}`);assert.equal(word(project.bytes(),ownNative),word(original,teamPaletteOffset(original,teamPointer(original,0x103d2,30))+2));

 const tones=kitToneColors('#2040c0',3);assert.deepEqual(tones,['#2142bd','#5a73ce','#94a5de']);
 for(const color of ['#000000','#ffffff','#d03010'])for(const count of [1,2,3,5]){const ramp=kitToneColors(color,count);assert.equal(ramp.length,count);for(let i=1;i<count;i++)for(const at of [1,3,5])assert.ok(parseInt(ramp[i].slice(at,at+2),16)>=parseInt(ramp[i-1].slice(at,at+2),16));}
 assert.throws(()=>kitToneColors('bad',3));assert.throws(()=>kitToneColors('#000000',0));
 async function verifyBatch(base,team,table,indices){
  const p=await RomProject.create(base),before=p.exportRom();
  const entries=kitToneColors('#2040c0',indices.length).map((color,i)=>({index:indices[i],color}));
  assert.throws(()=>p.setTeamColors(team,table,[entries[0],{index:999,color:'#ffffff'}]));assert.deepEqual(p.exportRom(),before,'Invalid batch must be atomic');
  const otherTeams=Array.from({length:42},(_,i)=>i).filter(i=>i!==team).map(i=>kitSections(before,i,table).map(part=>part.colors.map(e=>e.color)));
  p.setTeamColors(team,table,entries);const after=p.bytes();
  const parts=kitSections(after,team,table),all=parts.flatMap(part=>part.colors);
  for(const entry of entries)assert.equal(all.find(e=>e.index===entry.index).color,entry.color);
  const old=kitSections(before,team,table).flatMap(part=>part.colors);for(const entry of all.filter(e=>!indices.includes(e.index)))assert.equal(entry.color,old.find(e=>e.index===entry.index).color);
  assert.deepEqual(Array.from({length:42},(_,i)=>i).filter(i=>i!==team).map(i=>kitSections(after,i,table).map(part=>part.colors.map(e=>e.color))),otherTeams);
  p.undo();assert.deepEqual(p.exportRom(),before,'One undo restores the complete tone batch');p.redo();assert.deepEqual(p.bytes(),after);
 }
 await verifyBatch(original,30,0x1027a,[7,8,9]);await verifyBatch(original,30,0x10326,[6,7,8]);await verifyBatch(original,30,0x103d2,[0]);
 const kitScript=fs.readFileSync(path.join(__dirname,'../src/components/KitEditor.vue'),'utf8').split('<script>')[1].split('</script>')[0];
 const options=Function('kitSections','kitDrawingResource','kitDrawingMask','normalizeKitDrawing','kitToneColors','PixelEditor','RomImage',kitScript.replace(/^import .*;$/gm,'').replace('export default','return'))(kitSections,kitDrawingResource,kitDrawingMask,normalizeKitDrawing,kitToneColors,null,null);
 const events=[],vmKit={...options.data(),rom:original,baseline:original,team:30,originalTeam:30,table:0x1027a,$emit:(...e)=>events.push(e)};
 for(const [key,fn] of Object.entries(options.methods))vmKit[key]=fn.bind(vmKit);for(const [key,fn] of Object.entries(options.computed)){if(['parts','garments','extras'].includes(key))vmKit[key]=fn.call(vmKit);else Object.defineProperty(vmKit,key,{get:fn.bind(vmKit)});}
 vmKit.commitColor('#2040c0');assert.equal(events.length,0);assert.equal(vmKit.pendingPrimary,true);vmKit.resolveTones(true);assert.equal(events[0][0],'colors');assert.deepEqual(events[0][1],tones.map((color,i)=>({index:7+i,color})));assert.equal(vmKit.dirty,false);
 vmKit.commitColor('#ff0000');vmKit.resolveTones(false);assert.deepEqual(events[1][1],[{index:7,color:'#ff0000'}]);vmKit.commitColor('#00ff00');vmKit.cancelColor();assert.equal(events.length,2);assert.equal(vmKit.dirty,false);
 vmKit.toneIndex=1;vmKit.commitColor('#00ff00');assert.deepEqual(events[2][1],[{index:8,color:'#00ff00'}]);assert.equal(vmKit.pendingPrimary,false);
 vmKit.drawingOpen=true;vmKit.drawingPending=true;vmKit.commitColor('#000000');assert.equal(events.length,3);assert.equal(vmKit.dirty,true);
 const wc26=process.env.ISSD_WC26_ROM||path.join(require('node:os').homedir(),'Downloads/ISSDWC26RC1GB2.0.sfc');
 if(fs.existsSync(wc26)){
  await verifyBatch(fs.readFileSync(wc26),54,0x1037c,[0,1,2]);
  const p=await RomProject.create(fs.readFileSync(wc26)),base=p.bytes(),other=teamPaletteOffset(base,teamPointer(base,0x1037c,12))+2;
  p.setTeamColor(54,0x1037c,0,'#ff0000');const own=teamPaletteOffset(p.bytes(),teamPointer(p.bytes(),0x1037c,54))+2;assert.notEqual(own,other);assert.equal(word(p.bytes(),own),31);assert.deepEqual(p.bytes().slice(other,other+10),base.slice(other,other+10));
  assert.throws(()=>p.transaction([{id:'kit-colors:loader',offset:0x24ef,bytes:new Uint8Array(7)}]),/Cargador de paletas/);
  p.restore(`palette:${own}`);assert.deepEqual(p.bytes().slice(own,own+10),base.slice(other,other+10));p.undo();assert.equal(word(p.bytes(),own),31);
  assert.deepEqual((await RomProject.import(p.record(),base)).exportRom(),p.exportRom());assert.deepEqual((await RomProject.create(p.exportRom())).exportRom(),p.exportRom());
  p.undo();assert.deepEqual(p.exportRom(),base);p.redo();assert.equal(word(p.bytes(),own),31);
  const script=fs.readFileSync(path.join(__dirname,'../src/components/StudioEditor.vue'),'utf8').split('<script>')[1].split('</script>')[0],ast=require('@babel/parser').parse(script,{sourceType:'module'}),component=ast.program.body.find(n=>n.type==='ExportDefaultDeclaration').declaration,method=component.properties.find(n=>n.key.name==='methods').value.properties.find(n=>n.key.name==='editPalette');
  const editPalette=Function('teamPointer','teamPaletteOffset','word','palette','return ({'+script.slice(method.start,method.end)+'}).editPalette')(teamPointer,teamPaletteOffset,word,(await import('../src/rom/binary.mjs')).palette);
  const handler=await RomProject.create(base),vm={project:handler,rom:handler.bytes(),teamIndex:54,paletteTable:0x1037c,$refs:{},error:'',act(fn){try{fn();}catch(e){this.error=e.message;}},changed(){this.rom=this.project.bytes();}};
  editPalette.call(vm,other,'#e629c5');assert.equal(vm.error,'');assert.notEqual(teamPaletteOffset(vm.rom,teamPointer(vm.rom,0x1037c,54))+2,other);assert.deepEqual(vm.rom.slice(other,other+10),base.slice(other,other+10));

 }
 console.log('PASS kits: 24 editable poses, clothing masks, all 42 photos, unchanged graphic round trips, team colors, Chile palette isolation, restore/undo/recovery');
})().catch(e=>{console.error(e);process.exitCode=1;});
