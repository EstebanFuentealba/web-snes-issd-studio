const assert=require('assert/strict'),fs=require('fs'),path=require('path');
global.crypto ||= require('crypto').webcrypto;
(async()=>{
 const {RomProject}=await import('../src/rom/project.mjs');
 const {graphicResources,graphicPatches,selectionGroupGraphics,GROUP_RULES}=await import('../src/rom/graphics.mjs');
 const {imagePixels}=await import('../src/rom/image-import.mjs');
 const {TITLE_LEGAL_RULES}=await import('../src/rom/title-legal.mjs');
 const {groupTextPatches}=await import('../src/rom/group-text.mjs');
 const {allStarsPatch}=await import('../src/rom/selection.mjs');
 const file=path.join(__dirname,'../roms/International Superstar Soccer Deluxe (USA).sfc');
 if(!fs.existsSync(file)){console.log('SKIP composition local ROM tests');return;}
 const original=new Uint8Array(fs.readFileSync(file)),project=await RomProject.create(original),resources=graphicResources(original,0);
 const player=resources.find(r=>r.label.startsWith('Jugador completo'));
 assert.equal(player.matrix[0].length,32);assert.equal(player.matrix.length,48);
 // Large sprites use center coordinates minus four; the extra small shoe
 // remains at (10,-1), which is (20,32) in the composed canvas.
 assert.deepEqual(player.owners[32][20],{part:0,x:63,y:0});
 assert.ok(player.owners.flat().some(o=>o?.part===1));
 const background=resources.find(r=>r.id==='title-background');assert.ok(background.matrix.flat().every(v=>v<16));
 const logo=resources.find(r=>r.id==='title-logo'),blank=logo.matrix.map((row,y)=>row.map((v,x)=>logo.editable[y][x]?0:v));
 const rgba=Uint8Array.from(logo.matrix.flatMap(row=>row.flatMap(v=>v===0?[0,0,0,0]:[...[1,3,5].map(i=>parseInt(logo.colors[v].slice(i,i+2),16)),255])));
 assert.deepEqual(imagePixels(rgba,256,128,logo.colors,logo.matrix,logo.importEditable).matrix,logo.matrix,'PNG round trip preserves equal colors in separate layer palettes');
 // A red stroke crossing the logo and its backdrop must retain the native
 // silhouette, including background pixels inside otherwise editable tiles.
 for(let y=85;y<110;y++)for(let x=40;x<140;x++)rgba.set([222,0,8,255],(y*256+x)*4);
 const imported=imagePixels(rgba,256,128,logo.colors,logo.matrix,logo.importEditable).matrix;
 let preservedPadding=0,visibleChanges=0;
 logo.matrix.forEach((row,y)=>row.forEach((v,x)=>{
  if(!logo.importEditable[y][x]){assert.equal(imported[y][x],v);if(logo.editable[y][x])preservedPadding++;}
  else if(imported[y][x]!==v)visibleChanges++;
 }));
 assert.ok(preservedPadding>0);assert.ok(visibleChanges>0);
 const importedProject=await RomProject.create(original);importedProject.transaction(graphicPatches(original,original,logo,imported));
 assert.deepEqual((await RomProject.import(importedProject.record())).exportRom(),importedProject.exportRom());
 project.transaction(graphicPatches(original,project.bytes(),logo,blank));
 const cleared=graphicResources(project.bytes(),0);
 assert.ok(cleared.find(r=>r.id==='title-logo').matrix.flat().every(v=>v<=1));
 assert.ok(cleared.find(r=>r.id==='title-background').matrix.flat().every(v=>v<=1));
 for(const label of resources.filter(r=>r.kind==='title-legal'))assert.deepEqual(cleared.find(r=>r.id===label.id).matrix,label.matrix);
 // Group font and title text edits must coexist without overlapping pools.
 const legal=cleared.find(r=>r.kind==='title-legal'),matrix=legal.matrix.map(row=>row.map(()=>4));
 project.transaction(graphicPatches(original,project.bytes(),legal,matrix));
 const group=selectionGroupGraphics(project.bytes())[5];project.transaction(groupTextPatches(original,project.bytes(),group,'GRUPO 1'));
 project.transaction([allStarsPatch(original,'hidden')]);
 const ranges=[...GROUP_RULES,...TITLE_LEGAL_RULES];
 for(let i=0;i<ranges.length;i++)for(let j=i+1;j<ranges.length;j++){
  const [,a,n]=ranges[i],[,b,m]=ranges[j];assert.ok(a+n<=b||b+m<=a,`${ranges[i][0]} overlaps ${ranges[j][0]}`);
 }
 assert.deepEqual(graphicResources(project.bytes(),0).find(r=>r.id===legal.id).matrix,matrix);
 assert.deepEqual((await RomProject.import(project.record())).exportRom(),project.exportRom());
 project.reset();assert.deepEqual(project.exportRom(),original);
 console.log('PASS composition: 16px sprite positions, second DMA row, separate red background, complete logo clearing, title notices and group/font pool isolation');
})().catch(e=>{console.error(e);process.exitCode=1;});
