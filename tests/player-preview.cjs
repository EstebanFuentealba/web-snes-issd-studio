const assert=require('assert/strict'),fs=require('fs');
global.crypto ||= require('crypto').webcrypto;
(async()=>{
 const file=__dirname+'/../roms/International Superstar Soccer Deluxe (USA).sfc';
 if(!fs.existsSync(file)){console.log('SKIP player preview: local ROM missing');return;}
 const rom=new Uint8Array(fs.readFileSync(file)),before=rom.slice();
 const {playerPreviewFrames}=await import('../src/rom/player-preview.mjs');
 const {readDeluxeTeam}=await import('../src/rom/deluxe.mjs');
 const {graphicResources}=await import('../src/rom/graphics.mjs');
 const {playerPatches,STATS}=await import('../src/rom/players.mjs');
 const {RomProject}=await import('../src/rom/project.mjs');
 const player={...readDeluxeTeam(rom,0).players[1],hair:0};
 const frames=playerPreviewFrames(rom,0,player);
 assert.equal(frames.length,8);
 const front=graphicResources(rom,0).find(r=>r.label.startsWith('Jugador completo')).matrix;
 // The menu's front view preserves every pixel of the existing OAM renderer,
 // including jersey details and the second DMA row.
 const matches=[];
 for(let y=0;y<=56-front.length;y++)for(let x=0;x<=48-front[0].length;x++)if(front.every((row,dy)=>row.every((pixel,dx)=>pixel===frames[0].matrix[y+dy][x+dx])))matches.push([x,y]);
 assert.equal(matches.length,1);
 for(let team=0;team<42;team++)for(const p of readDeluxeTeam(rom,team).players){
   const views=playerPreviewFrames(rom,team,p);
   for(const view of views){assert.equal(view.matrix.length,56);assert.ok(view.matrix.every(row=>row.length===48));assert.ok(view.matrix.flat().every(v=>Number.isInteger(v)&&v>=0&&v<16));assert.ok(view.matrix.flat().filter(Boolean).length>150);}
 }
 assert.notDeepEqual(playerPreviewFrames(rom,0,{...player,hair:13})[0].matrix,frames[0].matrix);
 assert.notDeepEqual(playerPreviewFrames(rom,0,{...player,position:1})[0].matrix,frames[0].matrix);
 assert.deepEqual(rom,before,'Rendering never writes to the ROM');
 const project=await RomProject.create(rom);
 for(const stat of STATS)for(const value of [1,10]){
   const old=readDeluxeTeam(project.bytes(),0).players[1][stat];
   project.transaction(playerPatches(project.bytes(),0,1,{[stat]:value}));
   assert.equal(readDeluxeTeam(project.exportRom(),0).players[1][stat],value);
   project.undo();assert.equal(readDeluxeTeam(project.bytes(),0).players[1][stat],old);
   project.redo();assert.equal(readDeluxeTeam(project.bytes(),0).players[1][stat],value);
 }
 const restored=await RomProject.import(project.record());assert.deepEqual(restored.exportRom(),project.exportRom());
 console.log('PASS player preview: eight menu directions for 840 players, native front composition, hair/goalkeeper poses, immutable ROM and editable stat export/undo/recovery');
})().catch(e=>{console.error(e);process.exitCode=1;});
