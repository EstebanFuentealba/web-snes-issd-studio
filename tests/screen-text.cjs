const assert=require('assert/strict'),fs=require('fs'),path=require('path');
global.crypto ||= require('crypto').webcrypto;
(async()=>{
 const {RomProject}=await import('../src/rom/project.mjs');
 const {screenTextResources}=await import('../src/rom/screen-text.mjs');
 const {graphicResources,graphicPatches}=await import('../src/rom/graphics.mjs');
 const {decompress}=await import('../src/rom/binary.mjs');
 const file=path.join(__dirname,'../roms/International Superstar Soccer Deluxe (USA).sfc');
 if(!fs.existsSync(file)){console.log('SKIP screen text local ROM tests');return;}
 const original=new Uint8Array(fs.readFileSync(file)),project=await RomProject.create(original),resources=screenTextResources(original);
 assert.equal(resources.length,5);
 assert.deepEqual(resources.map(r=>r.matrix.length),[64,128,64,128,16]);
 assert.equal(graphicResources(original,0).filter(r=>r.kind==='screen-text').length,5);
 for(const r of resources){
  assert.ok(r.matrix.every(row=>row.length===256));
  assert.ok(r.matrix.flat().every(p=>Number.isInteger(p)&&r.colors[p]));
  assert.ok(r.editable.flat().some(Boolean));
  project.transaction(graphicPatches(original,project.bytes(),r,r.matrix));
  assert.deepEqual(project.exportRom(),original);
 }
 // Check texture, shadow and flipped reflection are assembled from both BGs.
 const title=resources[0];
 assert.ok(title.matrix.slice(0,32).flat().some(p=>p>0&&p<16));
 assert.ok(title.matrix.slice(32).flat().some(p=>p>48));
 assert.ok(title.owners.flat().some(o=>o&&o.paletteBase===32));
 const clone=r=>r.matrix.map(row=>row.slice());
 const change=(r,base)=>{
  const matrix=clone(r);
  for(let y=0;y<matrix.length;y++)for(let x=0;x<256;x++){
   const owner=r.owners[y][x];if(!owner||owner.paletteBase!==base||!matrix[y][x])continue;
   matrix[y][x]=0;return matrix;
  }
  throw new Error('No editable stroke');
 };
 const edited=change(title,16);project.transaction(graphicPatches(original,project.bytes(),title,edited));
 assert.notDeepEqual(screenTextResources(project.bytes())[0].matrix,title.matrix);
 assert.deepEqual(screenTextResources(project.bytes())[4].matrix,resources[4].matrix);
 const patch=project.patches[0];assert.equal(decompress(project.bytes(),patch.offset).length,title.parts[0].decodedSize);
 project.undo();assert.deepEqual(project.exportRom(),original);project.redo();
 assert.deepEqual((await RomProject.import(project.record())).exportRom(),project.exportRom());
 for(const p of title.parts)project.transaction(project.restorePatches(p.id));
 assert.deepEqual(project.exportRom(),original);
 // Password glyphs are 2bpp and must stay independent of the splash atlas.
 const password=resources[4];assert.ok(password.parts.every(p=>p.bpp===2));
 project.transaction(graphicPatches(original,project.bytes(),password,change(password,0)));
 assert.notDeepEqual(screenTextResources(project.bytes())[4].matrix,password.matrix);
 for(let i=0;i<4;i++)assert.deepEqual(screenTextResources(project.bytes())[i].matrix,resources[i].matrix);
 assert.deepEqual((await RomProject.import(project.record())).exportRom(),project.exportRom());
 project.undo();assert.deepEqual(project.exportRom(),original);
 const invalid=clone(title);invalid[0][0]=1;
 assert.throws(()=>graphicPatches(original,original,title,invalid),/fuera de la zona/);
 assert.throws(()=>graphicPatches(original,original,title,[[0]]),/resolución/);
 const bad=clone(password);bad[0][0]=4;
 assert.throws(()=>graphicPatches(original,original,password,bad),/paleta/);
 console.log('PASS screen text: five compositions, two background layers, reflected palettes, shared font edits, password 2bpp, history, restore, import and export');
})();
