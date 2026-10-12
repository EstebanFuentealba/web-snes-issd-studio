const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
global.crypto ||= require('node:crypto').webcrypto;
(async()=>{
 const file=process.env.ISSD_WC26_ROM||path.join(require('node:os').homedir(),'Downloads/ISSDWC26RC1GB2.0.sfc');
 if(!fs.existsSync(file)){console.log('SKIP WC26 graphics local ROM tests');return;}
 const {RomProject}=await import('../src/rom/project.mjs');
 const {wc26StudioGraphics,wc26GraphicPatches,wc26RestoreGraphicPatches,wc26SharedTeams}=await import('../src/rom/wc26-graphics.mjs');
 const {openRom,loRom,word,decompress,tiles}=await import('../src/rom/binary.mjs');
 const {externalDeluxeLayout}=await import('../src/rom/external-layout.mjs');
 const input=new Uint8Array(fs.readFileSync(file)),rom=openRom(input).rom;
 const warnings=[],resources=wc26StudioGraphics(rom,0,warnings),profile=externalDeluxeLayout(rom);
 for(const label of ['Jugador completo','Portero completo','Detalles de camiseta','Números','Balón','Árbitro perro','Pelo 13','Foto 5','Menú principal','Contraseña'])assert.ok(resources.some(r=>r.label.startsWith(label)),label);
 assert.ok(resources.every(r=>!r.readOnly));
 assert.deepEqual(warnings,[]);assert.ok(resources.some(r=>r.id==='title-logo'));assert.ok(resources.some(r=>r.id==='title-background'));
 const logo=resources.find(r=>r.id==='title-logo'),background=resources.find(r=>r.id==='title-background');
 assert.equal(logo.matrix.length,128);assert.equal(logo.matrix[0].length,256);
 assert.deepEqual(logo.parts.map(p=>p.offset),[loRom(0x8a8000),loRom(0xb0c300),loRom(0xb0d030)]);
 assert.deepEqual(logo.parts.map(p=>p.decodedSize),[5344,4608,4096]);
 assert.ok(logo.owners.flat().some(o=>o?.part===1),'Trophy BG overwrite is editable');
 assert.ok(logo.owners.flat().some(o=>o?.part===2),'WORLD CUP text sprites are editable');
 assert.ok(logo.layers[42][32].some(o=>o.part===2&&o.x===0&&o.y===0),'OAM coordinates use sprite centers: first 16px tile is at (32,42)');
 assert.deepEqual(background.editableParts,[0]);assert.ok(background.owners.flat().every(o=>!o||o.part===0));
 const {imagePixels}=await import('../src/rom/image-import.mjs');
 const rgba=Uint8Array.from(logo.matrix.flatMap(row=>row.flatMap(v=>logo.colors[v]==='transparent'?[0,0,0,0]:[...[1,3,5].map(i=>parseInt(logo.colors[v].slice(i,i+2),16)),255])));
 assert.deepEqual(imagePixels(rgba,256,128,logo.colors,logo.matrix,logo.importEditable).matrix,logo.matrix,'PNG import preserves original layer palette indices');
 const {wc26TitleLogo}=await import('../src/rom/wc26-title.mjs');
 const invalid=rom.slice();invalid[loRom(0x829993)]=0;assert.throws(()=>wc26TitleLogo(invalid),/Cargador/);
 const project=await RomProject.create(input);
 for(const resource of resources){
  const r={...resource,kind:resource.externalKind||resource.kind};
  project.transaction(wc26GraphicPatches(rom,r,r.matrix,project.bytes()));
  assert.equal(project.patches.length,0,`Unchanged: ${r.label}`);
  const matrix=r.matrix.map((row,y)=>row.map((pixel,x)=>!r.editable||r.editable[y][x]?0:pixel));
  assert.notDeepEqual(matrix,r.matrix,r.label);
  const patches=wc26GraphicPatches(rom,r,matrix,project.bytes());
  project.transaction(patches);
  assert.ok(project.patches.length,r.label);
  const current=project.bytes(),edited=wc26StudioGraphics(current,0).find(g=>g.id===r.id);
  if(!['sprite','screen-text','composite'].includes(r.kind))assert.deepEqual(edited.matrix,matrix,`Readback: ${r.label}`);
  else {
   // Transparent tiles reveal underlying layers, so verify the original pixel owners.
   const strips=r.parts.map(part=>tiles(part.compressed?decompress(current,part.offset):current.slice(part.offset,part.offset+part.capacity),part.bpp,part.columns));
   matrix.forEach((row,y)=>row.forEach((pixel,x)=>{if(pixel!==r.matrix[y][x]){const owner=r.owners[y][x];assert.equal(strips[owner.part][owner.y][owner.x],0,`Readback: ${r.label}`);}}));
  }
  // Only the allocations emitted for this resource may change.
  for(let i=0;i<rom.length;i++)if(current[i]!==rom[i])assert.ok(patches.some(p=>i>=p.offset&&i<p.offset+p.bytes.length),`${r.label}: ${i}`);
  const exported=project.exportRom();assert.equal(openRom(exported).layout,'wc26-56');
  assert.deepEqual((await RomProject.import(project.record(),input)).exportRom(),exported);
  project.undo();assert.deepEqual(project.exportRom(),input);
  project.redo();assert.deepEqual(project.exportRom(),exported);
  project.transaction(wc26RestoreGraphicPatches(rom,edited));
  assert.deepEqual(project.exportRom(),input,`Restore: ${r.label}`);
 }
 const detail=resources.find(r=>r.label.startsWith('Detalles'));
 assert.deepEqual(wc26SharedTeams(rom,detail),Array.from({length:56},(_,i)=>i).filter(i=>loRom(0x980000|word(rom,profile.detailTable+i*2))===detail.parts[2].offset));
 assert.equal(wc26SharedTeams(rom,resources.find(r=>r.label.startsWith('Jugador completo'))).length,56);
 // Edits to separate shared tile blocks accumulate instead of reverting each other.
 const ball=resources.find(r=>r.label.startsWith('Balón')),hair=resources.find(r=>r.label.startsWith('Pelo 1 '));
 project.transaction(wc26GraphicPatches(rom,ball,ball.matrix.map(row=>row.map(()=>0)),project.bytes()));
 const first=project.bytes();project.transaction(wc26GraphicPatches(rom,hair,hair.matrix.map(row=>row.map(()=>0)),project.bytes()));
 assert.deepEqual(project.bytes().slice(ball.offset,ball.offset+ball.capacity),first.slice(ball.offset,ball.offset+ball.capacity));
 console.log(`PASS WC26 graphics: ${resources.length} editable resources; readback, bounded writes, export, recovery, undo/redo, restoration and shared shirt directories`);
})().catch(error=>{console.error(error);process.exitCode=1;});
