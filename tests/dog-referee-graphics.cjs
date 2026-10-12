const assert=require('assert/strict');
const fs=require('fs');
global.crypto=require('crypto').webcrypto;
(async()=>{
  const file='roms/International Superstar Soccer Deluxe (USA).sfc';
  if(!fs.existsSync(file)){console.log('SKIP dog referee graphics: local ROM unavailable');return;}
  const {openRom,loRom}=await import('../src/rom/binary.mjs');
  const {dogRefereeGraphics,dogRefereeSheet}=await import('../src/rom/dog-referee-graphics.mjs');
  const {graphicResources,graphicPatches}=await import('../src/rom/graphics.mjs');
  const {RomProject}=await import('../src/rom/project.mjs');
  const {dogRefereeMode}=await import('../src/rom/dog-referee.mjs');
  const original=openRom(fs.readFileSync(file)).rom,resources=dogRefereeGraphics(original);
  assert.equal(resources.length,45);
  assert.equal(new Set(resources.map(r=>r.id)).size,45);
  assert.equal(graphicResources(original,0).filter(r=>r.global).length,1);
  assert.deepEqual(dogRefereeSheet(original),graphicResources(original,1).find(r=>r.global));
  const parts=new Map(resources.flatMap(r=>r.parts.map(p=>[p.offset,p])));
  assert.equal(parts.size,50);
  // All 30 native assets are present, including both DMA rows. Only the
  // original 16-bit size headers between the pixel blocks are excluded.
  const ordered=[...parts.values()].sort((a,b)=>a.offset-b.offset);
  assert.equal(ordered[0].offset,loRom(0xad9425));
  assert.equal(ordered.at(-1).offset+ordered.at(-1).capacity,loRom(0xadb007));
  for(let i=1;i<ordered.length;i++)assert.equal(ordered[i].offset,ordered[i-1].offset+ordered[i-1].capacity+2);
  const project=await RomProject.create(original);
  for(const r of resources){
    assert.ok(r.matrix.flat().some(Boolean));
    assert.ok(r.matrix.length%8===0&&r.matrix[0].length%8===0);
    assert.equal(r.colors[0],'transparent');
    const patches=graphicPatches(original,original,r,r.matrix);
    for(const p of patches)assert.deepEqual(p.bytes,original.slice(p.offset,p.offset+p.bytes.length));
    project.transaction(patches);
  }
  assert.deepEqual(project.exportRom(),original);
  // Editing each visible tile in a pose changes precisely its native pixels,
  // with shared standing variants updated through the same source blocks.
  const standing=resources[0],matrix=standing.matrix.map(row=>row.slice());
  const owner=standing.owners.flat().find(Boolean),pixel=standing.matrix.flat()[standing.owners.flat().findIndex(Boolean)];
  matrix.forEach((row,y)=>row.forEach((_,x)=>{
    const o=standing.owners[y][x];if(o&&o.part===owner.part&&o.x===owner.x&&o.y===owner.y)matrix[y][x]=(pixel+1)%16;
  }));
  project.transaction(graphicPatches(original,project.bytes(),standing,matrix));
  assert.deepEqual(dogRefereeGraphics(project.bytes())[0].matrix,matrix);
  assert.equal(dogRefereeMode(project.bytes()),dogRefereeMode(original));
  for(const p of ordered){assert.equal(project.bytes()[p.offset-2],original[p.offset-2]);assert.equal(project.bytes()[p.offset-1],original[p.offset-1]);}
  assert.deepEqual((await RomProject.import(project.record())).exportRom(),project.exportRom());
  project.undo();assert.deepEqual(project.exportRom(),original);
  project.redo();assert.deepEqual(dogRefereeGraphics(project.bytes())[0].matrix,matrix);
  project.transaction(standing.parts.flatMap(p=>project.restorePatches(p.id)));
  assert.deepEqual(project.exportRom(),original);
  const lastUp=resources[8];assert.equal(lastUp.parts[1].offset,resources[7].parts[0].offset);
  assert.ok(lastUp.owners.flat().some(o=>o?.part===1),'Run 5 retains run 4 tile 2');
  const sheet=dogRefereeSheet(original);
  assert.equal(sheet.matrix.length,200);assert.equal(sheet.matrix[0].length,360);
  assert.equal(sheet.frames.length,45);assert.equal(sheet.parts.length,50);
  assert.equal(new Set(sheet.parts.map(p=>p.id)).size,50);
  for(const [i,f] of sheet.frames.entries()){
    const crop=sheet.matrix.slice(f.y,f.y+f.height).map(row=>row.slice(f.x,f.x+f.width));
    assert.deepEqual(crop,resources[i].matrix);
  }
  project.transaction(graphicPatches(original,original,sheet,sheet.matrix));assert.deepEqual(project.exportRom(),original);
  const sheetMatrix=sheet.matrix.map(row=>row.slice()),o=sheet.owners.flat().find(Boolean);
  sheetMatrix.forEach((row,y)=>row.forEach((v,x)=>{const owner=sheet.owners[y][x];if(owner&&owner.part===o.part&&owner.x===o.x&&owner.y===o.y)sheetMatrix[y][x]=(v+1)%16;}));
  project.transaction(graphicPatches(original,project.bytes(),sheet,sheetMatrix));
  assert.deepEqual(dogRefereeSheet(project.bytes()).matrix,sheetMatrix);
  assert.deepEqual((await RomProject.import(project.record())).exportRom(),project.exportRom());
  project.undo();assert.deepEqual(project.exportRom(),original);project.redo();
  project.transaction(sheet.parts.flatMap(p=>project.restorePatches(p.id)));assert.deepEqual(project.exportRom(),original);
  const gap=sheet.matrix.map(row=>row.slice());gap[0][0]=1;assert.throws(()=>graphicPatches(original,original,sheet,gap),/fuera de la zona editable/);
  console.log('PASS dog referee sheet: 360x200, 45 poses, 50 unique blocks, protected spacing, shared pixels, history and recovery; dog referee graphics: 45 poses, all 30 assets / 50 DMA blocks, original palette, lossless round trips, edits, size headers, sharing, history, restore and import/export');
})().catch(e=>{console.error(e);process.exitCode=1;});
