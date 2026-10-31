const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
global.crypto ||= require('node:crypto').webcrypto;
module.exports=async function flagPalettesRuntime(core,options={}){
 const {RomProject}=await import('../src/rom/project.mjs'),{playerPatches}=await import('../src/rom/players.mjs'),{graphicResources,flagPatches,flagPalettePatches}=await import('../src/rom/graphics.mjs'),{teamPointer,teamPaletteOffset}=await import('../src/rom/team-count.mjs'),{word}=await import('../src/rom/binary.mjs'),{editableGroups}=await import('../src/rom/group-editor.mjs'),{bigLabel}=await import('../src/rom/team-labels.mjs');
 const source=path.join(__dirname,'../roms/International Superstar Soccer Deluxe (USA).sfc'),original=new Uint8Array(fs.readFileSync(source)),directory=fs.mkdtempSync(path.join(os.tmpdir(),'issd-flag-palettes-'));
 const selector=[[400,20,3],[600,20,3],[800,20,3],[1100,20,8],[1300,20,8],[1500,20,8]];
 const match=events=>[...events,[3300,10,8],[3500,10,8],[3800,10,8],[4300,10,3],[4500,10,8],[4800,10,8],[5800,10,3],[6100,10,8],[8000,10,8],[8300,10,8],[8600,10,8],[9000,10,3]];
 function run(p,id,frames,events){
  const file=path.join(directory,id+'.sfc'),output=path.join(directory,id);fs.writeFileSync(file,p.exportRom());
  const result=spawnSync(process.env.PYTHON||'python3',[path.join(__dirname,'snes9x-headless.py'),path.resolve(core),file,output],{encoding:'utf8',timeout:60000,env:{...process.env,...(options.pixelFormat===undefined?{}:{ISSD_PIXEL_FORMAT:String(options.pixelFormat)}),ISSD_FRAMES:String(frames),ISSD_INPUT:JSON.stringify(events)}});
  assert.equal(result.status,0,result.stderr);const meta=JSON.parse(result.stdout.split('\n').find(s=>s.startsWith('{')));assert.ok([256,512].includes(meta.width));assert.equal(meta.height,224);
  const pixels=fs.readFileSync(output+'.ppm').subarray(Buffer.byteLength(`P6\n${meta.width} ${meta.height}\n255\n`)),image=Buffer.alloc(256*224*3),scale=meta.width/256;
  for(let y=0;y<224;y++)for(let x=0;x<256;x++)for(let c=0;c<3;c++)image[(y*256+x)*3+c]=pixels[(y*meta.width+x*scale)*3+c];
  return {ram:fs.readFileSync(output+'.ram'),image,output};
 }
 function verifyFlag(p,team,capture){
  const flag=graphicResources(p.bytes(),team)[0],rgb=flag.colors.map(c=>c==='transparent'?null:[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)));
  // Compare the complete rendered rectangle, including ink 12. Checking only
  // palette RAM missed the native uniform-color overwrite in earlier tests.
  for(let y=0;y<=208;y++)for(let x=0;x<=232;x++){
   let matches=true;
   for(let dy=0;dy<16&&matches;dy++)for(let dx=0;dx<24&&matches;dx++){
    const color=rgb[flag.matrix[dy][dx]],at=((y+dy)*256+x+dx)*3;
    if(!color||color.some((v,c)=>Math.abs(v-capture.image[at+c])>2))matches=false;
   }
   if(matches)return;
  }
  assert.fail(`Team ${team}: all four flag colors must appear together in ${capture.output}.png`);
 }
 function verifyKits(p,capture){
  const rom=p.bytes();for(const [base,destination]of [[0x0d00,0x10],[0x0e00,0x12]]){
   const team=word(capture.ram,base+0xa0)/2,table=word(capture.ram,base+0xa4)&8?0x102d0:0x1027a,source=teamPaletteOffset(rom,teamPointer(rom,table,team))+2,target=word(rom,0x9176+destination);
   assert.deepEqual(capture.ram.subarray(target,target+32),Buffer.from(rom.slice(source,source+32)),`Team ${team}: all sixteen uniform colors reach the match palette`);
  }
 }
 const p=await RomProject.create(original);p.transaction(playerPatches(p.bytes(),30,0,{name:'ABCDEFGHIJ',hair:10}));
 for(const [team,inks] of [[30,['#101010','#ff0000','#ffffff','#ffde00']],[2,['#080842','#00ff00','#00ffff','#ff00ff']]]){
  const flag=graphicResources(p.bytes(),team)[0],colors=flag.colors.slice(),matrix=flag.matrix.map(row=>row.map((_,x)=>12+Math.floor(x/6)));colors.splice(12,4,...inks);
  p.transaction([...flagPatches(original,p.bytes(),team,matrix),...flagPalettePatches(p.bytes(),team,colors)]);
 }
 const selected=run(p,'selector-four-colors',2000,selector);verifyFlag(p,30,selected);
 const game=run(p,'match-four-colors',10000,match(selector));assert.equal(word(game.ram,0xda0),60);assert.equal(word(game.ram,0xea0),4);
 verifyKits(p,game);verifyHeads(game);
 for(const [team,dest] of [[30,0x2d98],[2,0x2db8]]){const at=teamPaletteOffset(p.bytes(),teamPointer(p.bytes(),0xe7d8,team))+2;assert.deepEqual(game.ram.subarray(dest,dest+8),Buffer.from(p.bytes().slice(at,at+8)));verifyFlag(p,team,game);}
 // Hair overlays must never be attached to a goalkeeper object.
 function verifyHeads(capture){for(const base of [0xaa0,0xad0,0xba0,0xbd0,0xca0,0xcd0]){const parent=word(capture.ram,base+0x1c);if(parent)assert.notEqual(word(capture.ram,parent+0x30),1,'Goalkeeper must not use an outfield hair overlay');}}
 const evidence=path.join(__dirname,'../artifacts/flag-palette');fs.mkdirSync(evidence,{recursive:true});
 for(const capture of [selected,game])fs.copyFileSync(capture.output+'.png',path.join(evidence,(options.tag||'')+path.basename(capture.output)+'.png'));
 // Optional private fixture: recover the user's JSON against its exact USA
 // baseline and verify their drawings in a match, without committing the ROM.
 if(process.env.ISSD_FLAG_PROJECT){
  const record=JSON.parse(fs.readFileSync(process.env.ISSD_FLAG_PROJECT)),user=await RomProject.import(record,original),first=editableGroups(user.bytes()).find(g=>g.teams.length>=2);assert.ok(first);
  const selection=run(user,'user-selector-fixed',2000,selector);for(const team of first.teams)verifyFlag(user,team,selection);fs.copyFileSync(selection.output+'.png',path.join(evidence,(options.tag||'')+'user-selector-fixed.png'));
  const home=first.teams[1],away=first.teams[0],events=[...selector,[2100,10,7]],capture=run(user,'user-match-fixed',10000,match(events));
  assert.equal(word(capture.ram,0xda0),home*2);assert.equal(word(capture.ram,0xea0),away*2);verifyFlag(user,home,capture);verifyFlag(user,away,capture);
  verifyKits(user,capture);verifyHeads(capture);
  const versus=run(user,'user-versus-fixed',4701,match(events));
  for(const [team,left] of [[home,12],[away,164]]){const label=bigLabel(user.bytes(),team);label.matrix.forEach((row,y)=>row.forEach((pixel,x)=>{if(!pixel)return;const rgb=[1,3,5].map(i=>parseInt(label.colors[pixel].slice(i,i+2),16)),at=((52+y)*256+left+x)*3;assert.ok(rgb.every((v,c)=>Math.abs(v-versus.image[at+c])<=2),`Team ${team}: visible pre-match letter pixel ${x},${y}`);}));}
  fs.copyFileSync(versus.output+'.png',path.join(evidence,(options.tag||'')+'user-versus-fixed.png'));
  const playing=run(user,'user-playing-fixed',18000,[...match(events),[10100,10,3],[10120,6000,6]]);verifyHeads(playing);fs.copyFileSync(playing.output+'.png',path.join(evidence,(options.tag||'')+'user-playing-fixed.png'));
  fs.copyFileSync(capture.output+'.png',path.join(evidence,(options.tag||'')+'user-match-fixed.png'));fs.writeFileSync(path.join(evidence,'ISSD-proyecto-colores-corregidos.json'),JSON.stringify(user.record({includeOriginal:false})));
 }
 console.log(`PASS ${options.tag||'Snes9x '}flag palette runtime: four custom inks in selector and both match HUD logos, including ink 12 after uniform loading, safe goalkeeper overlays${process.env.ISSD_FLAG_PROJECT?', plus attached-project pre-match letter pixels and gameplay with its original ROM':''}. Captures: ${directory}`);
};
if(require.main===module)module.exports(process.env.SNES9X_CORE).catch(e=>{console.error(e);process.exitCode=1;});
