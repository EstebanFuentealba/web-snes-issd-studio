const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');global.crypto ||= require('node:crypto').webcrypto;
(async()=>{
 const {RomProject}=await import('../src/rom/project.mjs'),{stadiumGraphics,stadiumGraphicRules,stadiumGraphicPatch,stadiumPalettes,stadiumPalettePatch,restoreStadiumPatches}=await import('../src/rom/stadiums.mjs'),{stadiumViews}=await import('../src/rom/stadium-scene.mjs'),{stadiumAssetAddress}=await import('../src/rom/wc26-stadiums.mjs'),{decompress,loRom}=await import('../src/rom/binary.mjs');
 const file=process.env.ISSD_WC26_ROM||path.join(require('node:os').homedir(),'Downloads/ISSDWC26RC1GB2.0.sfc');if(!fs.existsSync(file)){console.log('SKIP WC26 stadiums: local ROM unavailable');return;}
 const original=new Uint8Array(fs.readFileSync(file)),p=await RomProject.create(original);
 assert.equal(stadiumAssetAddress(original,0x9aa4c2),0x9bfa90);assert.equal(stadiumAssetAddress(original,0x9ab6f2),0x878486);
 for(let i=0;i<8;i++){const rs=stadiumGraphics(original,i);assert.ok(rs.length>=8);assert.ok(stadiumPalettes(original,i).length);for(const r of rs){assert.ok(r.matrix.length);assert.ok(r.capacity>2);for(const v of stadiumViews(original,i,r)){assert.ok(v.editable.some(row=>row.some(Boolean)));assert.equal(v.matrix.length,v.editable.length);}}}
 for(const logical of [0x9aa4c2,0x9ab6f2,0x9de78f]){
  const resource=stadiumGraphics(p.bytes(),logical===0x9aa4c2||logical===0x9ab6f2?1:0).find(r=>r.address===logical),matrix=resource.matrix.map(row=>row.map(()=>0));const patch=stadiumGraphicPatch(original,resource,matrix);assert.equal(patch.offset,loRom(stadiumAssetAddress(original,logical)));p.transaction([patch]);assert.deepEqual(stadiumGraphics(p.bytes(),logical===0x9aa4c2||logical===0x9ab6f2?1:0).find(r=>r.id===resource.id).matrix,matrix);
  // A second edit must retain the original reservation after compression
  // shrinks the block header. It cannot touch the neighboring flag assets.
  const next=stadiumGraphics(p.bytes(),logical===0x9aa4c2||logical===0x9ab6f2?1:0).find(r=>r.id===resource.id);matrix[0][0]=1;const second=stadiumGraphicPatch(original,next,matrix);assert.equal(second.bytes.length,patch.bytes.length);p.transaction([second]);
 }
 const palette=stadiumPalettes(p.bytes(),0)[0];p.transaction([stadiumPalettePatch(p.bytes(),palette.id,0,'#ff0000')]);assert.equal(stadiumPalettes(p.bytes(),0)[0].colors[0],'#ff0000');
 const exported=p.exportRom(),allowed=p.patches.map(p=>[p.offset,p.offset+p.bytes.length]);for(let i=0;i<exported.length;i++)if(exported[i]!==original[i])assert.ok(i>=0x7fdc&&i<0x7fe0||allowed.some(([a,b])=>i>=a&&i<b),`Unexpected stadium write ${i.toString(16)}`);
 assert.deepEqual((await RomProject.import(p.record())).exportRom(),exported);assert.deepEqual((await RomProject.create(exported)).exportRom(),exported);p.undo();p.redo();assert.deepEqual(p.exportRom(),exported);
 p.transaction(restoreStadiumPatches(original,p.bytes(),1));assert.ok(!p.patches.some(p=>p.id==='stadium:graphic:10134722'||p.id==='stadium:graphic:10139378'));assert.deepEqual(p.bytes().slice(loRom(0x878486),loRom(0x878486)+1488),original.slice(loRom(0x878486),loRom(0x878486)+1488));
 const bad=original.slice();bad[loRom(0x828606)]^=1;assert.throws(()=>stadiumGraphics(bad,1),/cargadores/);
 console.log('PASS WC26 stadiums: 38 graphics and 8 assembled scenes, verified relocated loader operands, palettes, repeat edits without reservation shrinkage, restoration, byte boundaries, history and project/ROM recovery');
})().catch(e=>{console.error(e);process.exitCode=1;});
