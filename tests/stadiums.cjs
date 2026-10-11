const assert=require('assert/strict'),fs=require('fs');
global.crypto ||= require('crypto').webcrypto;
(async()=>{
 const m=await import('../src/rom/stadiums.mjs'),{loRom,word,decompress}=await import('../src/rom/binary.mjs');
 for(const [kind,l,w] of [['yards',99,82],['yards',141,82],['yards',118,63],['yards',118,97],['field',1791,640],['field',2177,640],['field',1857,640],['field',1856,641],['field',1856,705],['yards',NaN,82],['yards',118.5,82]])assert.throws(()=>m.stadiumMeasurePatch(0,kind,l,w));
 for(const i of [-1,8,0.5])assert.throws(()=>m.stadiumMeasurePatch(i,'yards',118,82));
 assert.deepEqual([...m.stadiumMeasurePatch(1,'field',1920,704).bytes],[128,7,192,2]);
 const filename='roms/International Superstar Soccer Deluxe (USA).sfc';if(!fs.existsSync(filename)){console.log('PASS stadium ranges; SKIP local USA ROM integration');return;}
 const original=new Uint8Array(fs.readFileSync(filename)),{RomProject}=await import('../src/rom/project.mjs'),{bigTeamNamePatches,teamNameTexts}=await import('../src/rom/team-labels.mjs');
 const stock=m.readStadiums(original),p=await RomProject.create(original);
 assert.deepEqual(stock.map(s=>s.name),['JAPAN','U.S.A','SPAIN','ITALY','ENGLAND','GERMANY','BRAZIL','NIGERIA']);
 const dataRange=original.slice(m.STADIUM_NAME_BASE,m.STADIUM_NAME_BASE+56);
 for(const name of ['', 'ABCDEFGH', 'ÑUBLE','123','A/B'])assert.throws(()=>m.stadiumNamePatches(original,original,0,name));
 p.transaction(m.stadiumNamePatches(original,p.bytes(),1,'CHILE'));p.transaction(m.stadiumNamePatches(original,p.bytes(),3,'NACION.'));
 assert.equal(m.readStadiums(p.bytes())[1].name,'CHILE');assert.equal(m.readStadiums(p.bytes())[3].name,'NACION.');
 assert.deepEqual(p.bytes().slice(0xc0000,0xc3000),original.slice(0xc0000,0xc3000),'Team OAM and fonts must stay byte-identical');
 p.undo();assert.equal(m.readStadiums(p.bytes())[3].name,'ITALY');p.redo();assert.equal(m.readStadiums(p.bytes())[3].name,'NACION.');
 assert.deepEqual((await RomProject.import(p.record())).bytes(),p.bytes());
 // The selector hook populates only a temporary frame, preserving the CPU's
 // data bank, X/Y and stack. Execute every opcode rather than matching bytes.
 function runLabel(rom,index){
  const ram=new Uint8Array(65536).fill(0xa5),stack=[];let a=0,x=0x1234,y=0x4567,db=0x7e,pc=m.STADIUM_LABEL_CODE,zero=false;
  ram[0x4c]=index;ram[0x4d]=0;
  const byte=()=>rom[loRom(pc++)],w=()=>byte()|byte()<<8,long=()=>w()|byte()<<16,read=addr=>addr>>>16===0x7e?word(ram,addr&65535):word(rom,loRom(addr));
  const push16=n=>{stack.push(n>>>8&255,n&255);},pop16=()=>stack.pop()|stack.pop()<<8;
  for(let step=0;step<1000;step++){
   const at=pc,op=byte();switch(op){
    case 0xda:push16(x);break;case 0x5a:push16(y);break;case 0x8b:stack.push(db);break;case 0xf4:push16(w());break;case 0xab:db=stack.pop();break;
    case 0xa5:a=word(ram,byte());break;case 0x0a:a=a<<1&65535;break;case 0xaa:x=a;break;case 0xa0:y=w();break;
    case 0xbf:a=read(long()+x);break;case 0x99:{const dest=(w()+y)&65535;assert.equal(db,0x7e);ram[dest]=a&255;ram[dest+1]=a>>>8;break;}
    case 0xe8:x=x+1&65535;break;case 0xc8:y=y+1&65535;break;case 0xc0:zero=y===w();break;case 0xd0:{const offset=byte();if(!zero)pc+=offset<128?offset:offset-256;break;}
    case 0x7a:y=pop16();break;case 0xfa:x=pop16();break;case 0xa9:a=w();break;case 0x6b:assert.equal(stack.length,0);assert.equal(x,0x1234);assert.equal(y,0x4567);assert.equal(db,0x7e);assert.equal(a,0x4f02);return ram;
    default:throw Error(`Unexpected opcode ${op.toString(16)} at ${at.toString(16)}`);
   }
  }throw Error('Label hook did not terminate');
 }
 for(let i=0;i<8;i++){
  const rom=p.bytes(),ram=runLabel(rom,i),pool=m.stadiumLabelData(rom);
  for(let plane=0;plane<4;plane++)assert.deepEqual(ram.slice(0x4f02+plane*0x2000,0x4f22+plane*0x2000),pool.slice(i*128+plane*32,i*128+(plane+1)*32));
  assert.ok(word(ram,0x4f02)>0&&word(ram,0x4f02)<=14);
 }
 const renamed=p.bytes();p.transaction(m.restoreStadiumPatches(original,p.bytes(),1));assert.equal(m.readStadiums(p.bytes())[1].name,'U.S.A');assert.equal(m.readStadiums(p.bytes())[3].name,'NACION.');
 p.transaction(m.restoreStadiumPatches(original,p.bytes(),3));assert.deepEqual(p.bytes(),original);
 // Each field icon has its own 384-byte slice in the shared container.
 const mini=rom=>m.stadiumGraphics(rom,0).find(g=>g.partOffset!==null),mini0=mini(original),mini1=m.stadiumGraphics(original,1).find(g=>g.partOffset!==null);
 const edited0=mini0.matrix.map(r=>r.map(()=>0));p.transaction([m.stadiumGraphicPatch(original,mini0,edited0)]);
 const current1=m.stadiumGraphics(p.bytes(),1).find(g=>g.partOffset!==null),edited1=current1.matrix.map(r=>r.map(()=>1));p.transaction([m.stadiumGraphicPatch(original,current1,edited1)]);
 assert.equal(mini(p.bytes()).matrix[0][0],edited0[0][0]);p.transaction(m.restoreStadiumPatches(original,p.bytes(),0));assert.deepEqual(mini(p.bytes()).matrix,mini0.matrix);assert.deepEqual(m.stadiumGraphics(p.bytes(),1).find(g=>g.partOffset!==null).matrix,edited1);
 p.transaction(m.restoreStadiumPatches(original,p.bytes(),1));assert.deepEqual(p.bytes(),original);
 // Names must remain independent in both directions after a team rename.
 p.transaction(m.stadiumNamePatches(original,p.bytes(),1,'CHILE'));p.transaction(bigTeamNamePatches(original,p.bytes(),34,'USA'));
 assert.equal(m.readStadiums(p.bytes())[1].name,'CHILE');assert.equal(teamNameTexts(original,p.bytes(),34).large,'USA');
 p.addTeam('PERU');assert.equal(m.readStadiums(p.bytes())[1].name,'CHILE');runLabel(p.bytes(),1);assert.deepEqual((await RomProject.import(p.record())).bytes(),p.bytes());
 p.reset();assert.deepEqual(p.bytes(),original);
 // Test every graphic's unedited lossless path, and a real changed pixel.
 let edited;
 for(let i=0;i<8;i++)for(const g of m.stadiumGraphics(original,i)){
  const patch=m.stadiumGraphicPatch(original,g,g.matrix);
  assert.deepEqual(decompress(patch.bytes,0),decompress(original,g.offset));
  p.transaction([patch]);
  if(!edited&&!g.shared){const matrix=g.matrix.map(row=>row.slice());matrix[0][0]=(matrix[0][0]+1)%16;try{const changed=m.stadiumGraphicPatch(original,g,matrix);p.transaction([changed]);assert.equal(m.stadiumGraphics(p.bytes(),i).find(r=>r.id===g.id).matrix[0][0],matrix[0][0]);edited=changed;}catch(error){if(!/requiere/.test(error.message))throw error;}}
 }
 assert.ok(edited,'At least one native graphic must support a pixel edit');p.reset();
 const pal=m.stadiumPalettes(original,0)[0],before=pal.colors[1];p.transaction([m.stadiumPalettePatch(p.bytes(),pal.id,1,'#ffffff')]);assert.equal(m.stadiumPalettes(p.bytes(),0)[0].colors[1],'#ffffff');assert.notEqual(before,'#ffffff');
 assert.equal(m.stadiumPalettes(p.bytes(),1)[0].colors[1],m.stadiumPalettes(original,1)[0].colors[1]);
 const bad=p.patches[0];bad.bytes[1]|=128;assert.throws(()=>p.transaction([bad]),/BGR555/);p.reset();
 p.transaction([m.stadiumMeasurePatch(1,'yards',120,84),m.stadiumMeasurePatch(1,'field',1920,704)]);
 const {scenarioPitchSize,positionOnPitch,scenarioAutomaticPosition,scenarioStartChanges,scenarioPosition}=await import('../src/rom/scenario-position.mjs');
 const {readScenarios}=await import('../src/rom/scenarios.mjs');
 assert.deepEqual(scenarioPitchSize(1,p.bytes()),{length:1920,width:704});assert.deepEqual(positionOnPitch({x:1,y:1},1,p.bytes()),{x:1920,y:704});
 const s={...readScenarios(p.bytes())[0],stadium:1,start:8,ballX:255,x:255,ballY:0,y:0};assert.deepEqual(scenarioAutomaticPosition(s,p.bytes()),{x:128,y:256});
 assert.deepEqual(scenarioPosition({...s,...scenarioStartChanges(s,{stadium:1},p.bytes())}),{x:-1,y:256});
 assert.deepEqual((await RomProject.import(p.record())).bytes(),p.bytes());
 const output=p.exportRom(),checksum=output.reduce((sum,b)=>(sum+b)&65535,0);assert.equal(word(output,0x7fde),checksum);assert.equal(word(output,0x7fdc)^checksum,65535);
 const header=new Uint8Array(512).fill(0x5a),headered=await RomProject.create(new Uint8Array([...header,...original]));headered.transaction(m.stadiumNamePatches(headered.original,headered.bytes(),7,'CHILE'));assert.deepEqual(headered.exportRom().slice(0,512),header);assert.equal(m.readStadiums(headered.exportRom().slice(512))[7].name,'CHILE');
 const reopened=await RomProject.create(headered.exportRom());reopened.transaction(m.stadiumNamePatches(reopened.original,reopened.bytes(),7,'PERU'));m.validateStadiums(reopened.bytes(),reopened.original);
 // Reject forged or partial project resources; no successful transaction
 // may install an incomplete loader, even if a resource's size is correct.
 const namePatch=m.stadiumNamePatches(original,original,0,'PERU')[0];assert.throws(()=>p.transaction([namePatch]),/incompletos/);
 const corrupted=m.stadiumNamePatches(original,p.bytes(),0,'PERU');corrupted.find(p=>p.id==='stadium:label-code').bytes[0]=0xea;assert.throws(()=>p.transaction(corrupted),/inválidos/);
 const forged=headered.record();forged.patches.find(p=>p.id==='stadium:label-hook').bytes=Buffer.from([0xea,0xea,0xea,0xea]).toString('base64');await assert.rejects(RomProject.import(forged),/incompletos/);
 p.reset();assert.deepEqual(p.bytes().slice(m.STADIUM_NAME_BASE,m.STADIUM_NAME_BASE+56),dataRange);
 console.log('PASS stadiums: eight native slots, independent names and CPU OAM hook, team expansion, dimensions and live scenario coordinates, every lossless graphic, pixel edits, palettes, undo/redo, restoration, project validation and SMC/checksum export');
})().catch(e=>{console.error(e);process.exitCode=1;});
