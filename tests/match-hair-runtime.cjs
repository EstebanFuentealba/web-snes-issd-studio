const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
global.crypto ||= require('node:crypto').webcrypto;
module.exports=async function matchHairRuntime(core,options={}){
 const {RomProject}=await import('../src/rom/project.mjs'),{playerPatches}=await import('../src/rom/players.mjs'),{word}=await import('../src/rom/binary.mjs'),{editableGroups}=await import('../src/rom/group-editor.mjs');
 const original=new Uint8Array(fs.readFileSync(path.join(__dirname,'../roms/International Superstar Soccer Deluxe (USA).sfc'))),dir=fs.mkdtempSync(path.join(os.tmpdir(),'issd-match-hair-')),evidence=path.join(__dirname,'../artifacts/field-glitch');fs.mkdirSync(evidence,{recursive:true});
 const selector=[[400,20,3],[600,20,3],[800,20,3],[1100,20,8],[1300,20,8],[1500,20,8]];
 const match=extra=>[...selector,[3300,10,8],...extra,[3500,10,8],[3800,10,8],[4300,10,3],[4500,10,8],[4800,10,8],[5800,10,3],[6100,10,8],[8000,10,8],[8300,10,8]];
 const movement=[];for(let f=0;f<8000;f+=240)movement.push([8351+f,210,[7,5,6,4][f/240%4]],[8351+f+30,10,0],[8351+f+100,10,8]);
 // Do not move the pause-menu cursor or confirm Replay while paused.
 const pauses=Array.from({length:8},(_,i)=>[8351+500+i*1000,8351+640+i*1000]),controls=[];
 for(const [start,duration,key]of movement){let segments=[[start,start+duration]];for(const [a,b]of pauses)segments=segments.flatMap(([x,y])=>y<=a||x>=b?[[x,y]]:[[x,Math.min(y,a)],[Math.max(x,b),y]].filter(([l,r])=>l<r));for(const [a,b]of segments)controls.push([a,b-a,key]);}
 for(const [a]of pauses)controls.push([a,10,3],[a+120,10,3]);
 function verifySlots(ram){
  const slots=[0xaa0,0xad0,0xba0,0xbd0,0xca0,0xcd0],tiles=[];
  for(let i=0;i<slots.length;i++){const at=slots[i],parent=word(ram,at+0x1c),tile=word(ram,at+0x1a);assert.ok(parent>= (i<3?0x500:0x1000)&&parent< (i<3?0x1000:0x1b00),`Hair slot ${i} must belong to its own squad`);assert.notEqual(word(ram,parent+0x30)&255,1,'No outfield hair on a goalkeeper');assert.ok([0x1a5,0x1a6,0x1a7,0x1a8,0x1b5,0x1b6].includes(tile),`Hair slot ${i}: invalid VRAM tile ${tile.toString(16)}`);tiles.push(tile);}
  assert.equal(new Set(tiles).size,6,'Six independent native hair tiles');
 }
 function run(p,id,extra,teams=[30,2]){
  const file=path.join(dir,id+'.sfc'),output=path.join(dir,id);fs.writeFileSync(file,p.exportRom());
  const result=spawnSync(process.env.PYTHON||'python3',[path.join(__dirname,'snes9x-headless.py'),path.resolve(core),file,output],{encoding:'utf8',timeout:120000,env:{...process.env,...(options.pixelFormat===undefined?{}:{ISSD_PIXEL_FORMAT:String(options.pixelFormat)}),ISSD_INPUT:JSON.stringify([...match(extra),...controls]),ISSD_FRAMES:'16351',ISSD_CHECK_FIELD_MAP_FROM:'8350',ISSD_CAPTURE_FRAMES:'[8350,8850,12000]'}});
  assert.equal(result.status,0,`${output}: ${result.stderr}`);const start=fs.readFileSync(output+'.8350.ram');assert.deepEqual([word(start,0xda0)/2,word(start,0xea0)/2],teams);for(const f of [8350,8850,12000]){verifySlots(fs.readFileSync(output+'.'+f+'.ram'));fs.copyFileSync(output+'.'+f+'.png',path.join(evidence,(options.tag||'snes9x-')+id+'.'+f+'.png'));}
  verifySlots(fs.readFileSync(output+'.ram'));fs.copyFileSync(output+'.png',path.join(evidence,(options.tag||'snes9x-')+id+'.png'));
 }
 const p=await RomProject.create(original);p.transaction(playerPatches(p.bytes(),30,0,{name:'ABCDEFGHIJ'}));
 for(const team of [30,2])for(let i=0;i<20;i++)p.transaction(playerPatches(p.bytes(),team,i,{hair:1+i%13}));
 run(p,'all-players-have-hair',[]);
 if(process.env.ISSD_FLAG_PROJECT){const record=JSON.parse(fs.readFileSync(process.env.ISSD_FLAG_PROJECT)),user=await RomProject.import(record,original);const group=editableGroups(user.bytes()).find(g=>g.teams.length>=2);assert.ok(group);run(user,'user-hair-slots',[[3400,10,7]],group.teams.slice(0,2));}
 console.log(`PASS ${options.tag||'Snes9x '}match hair: six bounded overlay slots, correct squad ownership, no goalkeeper overlays, and field VRAM checked every frame through 8000 frames of movement, passes and pauses${process.env.ISSD_FLAG_PROJECT?', including the attached project':''}. Captures: ${dir}`);
};
if(require.main===module)module.exports(process.env.SNES9X_CORE).catch(e=>{console.error(e);process.exitCode=1;});
