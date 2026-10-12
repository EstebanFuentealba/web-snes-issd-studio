const assert=require('assert/strict'),fs=require('fs'),path=require('path');
global.crypto ||= require('crypto').webcrypto;
(async()=>{
 const {RomProject}=await import('../src/rom/project.mjs');
 const {MENU_SCREENS,MENU_TEXT_RULES,readMenuText,menuTextPatches,restoreMenuTextPatches,validateMenuTexts,menuTextPreview}=await import('../src/rom/menu-text.mjs');
 const {loRom,decompress,word}=await import('../src/rom/binary.mjs');
 const {compress}=await import('../src/rom/compression.mjs');
 const {mainMenuBackground,mainMenuGraphics}=await import('../src/rom/main-menu.mjs');
 const file=path.join(__dirname,'../roms/International Superstar Soccer Deluxe (USA).sfc');
 if(!fs.existsSync(file)){console.log('SKIP menu text local ROM tests');return;}
 const original=new Uint8Array(fs.readFileSync(file)),project=await RomProject.create(original);
 validateMenuTexts(original,original);
 assert.equal(readMenuText(original,'secondary','option-1').text,'SHORT LEAGUE');
 assert.equal(readMenuText(original,'settings','level').text,'GAME LEVEL');
 assert.equal(readMenuText(original,'training','challenge').text,'CHALLENGE');
 assert.equal(readMenuText(original,'handicap','skill').text,'GOALKEEPER\nSKILL');
 assert.equal(readMenuText(original,'game','option-5').text,'KEY CONFIGURATION');
 const edits=[['secondary','option-1','LIGA CORTA'],['settings','level','NIVEL'],['training','training','PRACTICA'],['handicap','players','NUMERO\nJUGAD'],['game','option-0','INICIAR JUEGO'],['game','option-3','ESTRATEGIA']];
 for(const [screen,key,text] of edits){
  const before=project.bytes(),others=MENU_SCREENS.flatMap(s=>s.fields.map(f=>[s.id,f.key,readMenuText(before,s.id,f.key).text]));
  project.transaction(menuTextPatches(original,before,screen,key,text));
  assert.equal(readMenuText(project.bytes(),screen,key).text,text);
  for(const [s,k,t] of others)if(s!==screen||k!==key)assert.equal(readMenuText(project.bytes(),s,k).text,t,`${s}/${k} changed unexpectedly`);
 }
 const exported=project.exportRom(),reopened=await RomProject.create(exported);
 for(const [s,k,t] of edits)assert.equal(readMenuText(reopened.bytes(),s,k).text,t);
 assert.deepEqual((await RomProject.import(project.record())).exportRom(),exported);
 const checksum=exported.reduce((n,b)=>(n+b)&65535,0);assert.equal(word(exported,0x7fde),checksum);assert.equal(word(exported,0x7fdc)^checksum,65535);
 project.undo();assert.equal(readMenuText(project.bytes(),'game','option-3').text,'ADJUST STRATEGY');project.redo();assert.equal(readMenuText(project.bytes(),'game','option-3').text,'ESTRATEGIA');
 project.transaction(restoreMenuTextPatches(original,project.bytes(),'game','option-0'));
 assert.equal(readMenuText(project.bytes(),'game','option-0').text,'GAME START');assert.equal(readMenuText(project.bytes(),'game','option-3').text,'ESTRATEGIA');
 project.transaction(restoreMenuTextPatches(original,project.bytes(),'game','option-3'));
 assert.ok(!project.patches.some(p=>p.id.startsWith('menu-text:game:')));
 // Every field can be changed and restored without writing adjacent control
 // bytes or other labels, including the compact handicap tile strings.
 const allFields=await RomProject.create(original);
 for(const screen of MENU_SCREENS)for(const f of screen.fields){
  const before=allFields.bytes(),text='A'.repeat(f.columns);
  allFields.transaction(menuTextPatches(original,before,screen.id,f.key,text));
  assert.equal(readMenuText(allFields.bytes(),screen.id,f.key).text,text);
  allFields.transaction(restoreMenuTextPatches(original,allFields.bytes(),screen.id,f.key));
  const restored=allFields.bytes();
  assert.deepEqual(restored,before);
 }
 const background=mainMenuBackground(original);
 assert.deepEqual(background.matrix,mainMenuGraphics(original)[2].matrix);
 // All five canvases retain the ROM background beneath their text/panels,
 // and show draft labels before the edited bytes are saved to the project.
 for(const screen of MENU_SCREENS){
  const key=screen.fields[0].key,p=menuTextPreview(original,screen.id,key);
  assert.equal(p.matrix.length,224);assert.equal(p.matrix[0].length,256);assert.ok(p.matrix.flat().every(i=>Number.isInteger(i)&&p.colors[i]));
  assert.deepEqual(p.colors.slice(0,16),background.colors);
  let backgroundPixels=0;
  p.matrix.forEach((row,y)=>row.forEach((pixel,x)=>{if(pixel<16){assert.equal(pixel,background.matrix[y][x]);backgroundPixels++;}}));
  assert.ok(backgroundPixels>0);
  const draft=original.slice();menuTextPatches(original,original,screen.id,key,'A').forEach(patch=>draft.set(patch.bytes,patch.offset));
  assert.notDeepEqual(menuTextPreview(draft,screen.id,key).matrix,p.matrix);
  const recolored=original.slice();recolored[loRom(0x89e49e)+2]^=31;
  assert.deepEqual(menuTextPreview(recolored,screen.id,key).colors.slice(0,16),mainMenuBackground(recolored).colors);
  assert.notDeepEqual(menuTextPreview(recolored,screen.id,key).colors,p.colors);
 }
 for(const [s,k,t] of [['settings','level','Á'],['game','option-0','X'.repeat(16)],['training','training',''],['secondary','option-0','A\nB']])assert.throws(()=>menuTextPatches(original,original,s,k,t));
 const field=MENU_TEXT_RULES.find(([id])=>id==='menu-text:settings:level');
 assert.throws(()=>project.transaction([{id:field[0],offset:field[1],bytes:new Uint8Array(field[2]).fill(0xff)}]));
 const occupied=original.slice();occupied[loRom(0xaafc3f)]=1;assert.throws(()=>menuTextPatches(occupied,occupied,'game','option-0','START'));
 const changes=menuTextPatches(original,original,'game','option-0','START'),corrupt=original.slice();changes.forEach(p=>corrupt.set(p.bytes,p.offset));
 const map=decompress(corrupt,loRom(0xaafc3f));map[0]^=1;
 const bytes=new Uint8Array(961).fill(255);bytes.set(compress(map));corrupt.set(bytes,loRom(0xaafc3f));assert.throws(()=>validateMenuTexts(corrupt,original));
 const malformed=changes.map(p=>p.id.endsWith('loader')?{...p,bytes:Uint8Array.of(0,0,0)}:p);assert.throws(()=>project.transaction(malformed));
 // All mutations are restricted to registered text slots, the game map pool
 // and its one loader. The other game menu variants retain their loaders.
 assert.deepEqual(exported.slice(loRom(0x82920b),loRom(0x82922e)),original.slice(loRom(0x82920b),loRom(0x82922e)));
 for(let i=0;i<exported.length;i++)if(exported[i]!==original[i]&&(i<0x7fdc||i>=0x7fe0))assert.ok(MENU_TEXT_RULES.some(([,o,n])=>i>=o&&i<o+n),`Unexpected write at ${i.toString(16)}`);
 console.log('PASS menu text: five editable menus, every label, independent edits, exported ROM reopen, project import, undo/redo, exact restore, checksums, previews, invalid input, occupied pool and map/loader validation');
})();
