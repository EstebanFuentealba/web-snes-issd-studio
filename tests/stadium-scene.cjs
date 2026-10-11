const assert=require('assert/strict'),fs=require('fs');
(async()=>{
 const {stadiumGraphics,stadiumGraphicPatch,stadiumPalettes}=await import('../src/rom/stadiums.mjs');
 const {stadiumViews,stadiumViewPixels,normalizeStadiumView,stadiumViewColor}=await import('../src/rom/stadium-scene.mjs');
 const file=__dirname+'/../roms/International Superstar Soccer Deluxe (USA).sfc';if(!fs.existsSync(file)){console.log('SKIP stadium scenes: local ROM missing');return;}
 const rom=new Uint8Array(fs.readFileSync(file));let checked=0;
 for(let index=0;index<8;index++)for(const resource of stadiumGraphics(rom,index))for(const view of stadiumViews(rom,index,resource)){
  assert.deepEqual(stadiumViewPixels(resource,view,view.matrix),resource.matrix,'Composed no-op preserves every source tile');
  assert.ok(view.matrix.every(row=>row.every(v=>v>=0&&v<view.colors.length)));
  view.owners.forEach((row,y)=>row.forEach((o,x)=>{if(o)assert.equal(view.matrix[y][x]&15,resource.matrix[o.y][o.x],'Native tile flips map to the right source pixel');}));checked++;
 }
 // Empty foreground tile zero must not hide the textured background or
 // center markings in the default grass view.
 for(let index=0;index<8;index++){
  const grass=stadiumGraphics(rom,index).find(g=>g.address===0x9de78f),view=stadiumViews(rom,index,grass)[0];
  const values=view.matrix.flat();assert.ok(new Set(values).size>8,'Grass must retain its native texture');
  const bright=values.filter(v=>[1,3,5].every(i=>parseInt(view.colors[v].slice(i,i+2),16)>=200));assert.ok(bright.length>100,'The default grass view includes recognizable white pitch markings');
  assert.ok(view.owners.flat().filter(Boolean).length>values.length*.8,'Grass remains editable beneath empty foreground');
 }
 // Large terrain borders surround the pitch: their bounding-box center
 // contains grass rather than editable dirt. Keep the first crop on the wall.
 for(const [index,address] of [[0,0x9991e0],[1,0x9ab6f2],[7,0xa2b4c5]]){
  const resource=stadiumGraphics(rom,index).find(g=>g.address===address),view=stadiumViews(rom,index,resource)[0];
  assert.ok(view.editable.flat().filter(Boolean).length>1000,'Terrain preview must contain editable terrain rather than only the pitch center');
  const context=view.matrix.map((row,y)=>row.map((v,x)=>view.editable[y][x]?v:(v+1)%view.colors.length));
  assert.deepEqual(stadiumViewPixels(resource,view,context),resource.matrix,'Surrounding grass and banners stay protected');
 }
 // The original crowd is an eight-pixel band behind a wall. Preserve that
 // entire band and align horizontal crops to complete native Map32 groups.
 for(let index=0;index<8;index++){
  const audience=stadiumGraphics(rom,index).find(g=>g.address===0x9f8a40),view=stadiumViews(rom,index,audience)[0];
  assert.ok(view.matrix[0].length<=160);assert.ok(view.matrix.length>=96);assert.equal(view.crop.x%32,0);
  const rows=new Set(),sourceRows=new Set();view.owners.forEach((row,y)=>row.forEach(o=>{if(o&&Math.floor(o.y/8)*audience.columns+Math.floor(o.x/8)<8){rows.add(y);sourceRows.add(o.y%8);}}));
  assert.equal(sourceRows.size,8,'All eight native crowd rows are included');assert.ok(Math.min(...rows)>0&&Math.max(...rows)<view.matrix.length-1,'Crowd is surrounded by context, not clipped vertically');
 }
 // Cartel 3 includes transparent foreground edges around the bunting and
 // attendant. Draw the background there while retaining writable native zero.
 let transparentEdges=0;
 for(let index=0;index<8;index++)for(const resource of stadiumGraphics(rom,index).filter(g=>g.label==='Capa 1 · Cartel 3')){
  const view=stadiumViews(rom,index,resource)[0];assert.ok(view.editable.flat().some(Boolean),'Cartel 3 has editable pixels in the default view');
  if(view.region.w<=view.crop.width&&view.region.h<=view.crop.height){assert.ok(view.crop.x<=view.region.x&&view.crop.x+view.crop.width>=view.region.x+view.region.w);assert.ok(view.crop.y<=view.region.y&&view.crop.y+view.crop.height>=view.region.y+view.region.h,'Cartel 3 fits completely inside its crop');}
  view.matrix.forEach((row,y)=>row.forEach((value,x)=>{const underlay=view.underlays[y][x];if(view.owners[y][x]&&typeof underlay==='number'){
   assert.equal(stadiumViewColor(view,view.bases[y][x],x,y),view.colors[underlay],'Erasing foreground reveals the background');
   if((value&15)===0){assert.equal(stadiumViewColor(view,value,x,y),view.colors[underlay]);assert.ok(view.editable[y][x]);transparentEdges++;}
  }}));
 }
 assert.ok(transparentEdges>0,'Transparent foreground edges are exercised');
 for(const address of [0x998182,0xa18a0a,0x9de78f,0x9991e0,0x9f8a40,0x9990a0]){
  const resource=stadiumGraphics(rom,0).find(g=>g.address===address),view=stadiumViews(rom,0,resource)[0];assert.ok(view);
  const points=view.owners.flatMap((row,y)=>row.flatMap((o,x)=>o?[{x,y,o}]:[])),p=points[0],q=points.find(q=>q.o.x!==p.o.x||q.o.y!==p.o.y);
  const first=view.matrix.map(row=>row.slice());first[p.y][p.x]=view.bases[p.y][p.x]+((first[p.y][p.x]+1)&15);
  const normalized=normalizeStadiumView(resource,view,first);const second=normalized.map(row=>row.slice());second[q.y][q.x]=view.bases[q.y][q.x]+((second[q.y][q.x]+1)&15);
  const both=normalizeStadiumView(resource,view,second,normalized);
  assert.equal(both[p.y][p.x],normalized[p.y][p.x],'A second stroke preserves the first');
  points.filter(t=>t.o.x===p.o.x&&t.o.y===p.o.y).forEach(t=>assert.equal(both[t.y][t.x]&15,both[p.y][p.x]&15,'Repeated and mirrored appearances stay synchronized'));
  const cleared=view.matrix.map((row,y)=>row.map((v,x)=>view.editable[y][x]?view.bases[y][x]:v));const raw=stadiumViewPixels(resource,view,cleared),patch=stadiumGraphicPatch(rom,resource,raw),edited=rom.slice();edited.set(patch.bytes,patch.offset);
  assert.deepEqual(stadiumGraphics(edited,0).find(g=>g.id===resource.id).matrix,raw,'Assembled edits survive compression and reopening');
  const restored=stadiumGraphicPatch(rom,stadiumGraphics(edited,0).find(g=>g.id===resource.id),resource.matrix);assert.deepEqual(restored.bytes,resource.bytes);
 }
 // Exercise the shared pixel editor's actual brush/fill/history handlers with
 // palette-relative ink: choosing the current color must terminate immediately.
 const script=fs.readFileSync(__dirname+'/../src/components/PixelEditor.vue','utf8').split('<script>')[1].split('</script>')[0].replace(/^import .*;$/gm,'').replace('export default','return');
 const options=new Function('RomImage','imagePalette',script)({},()=>[]);
 const editor={matrix:[[17,17],[17,17]],original:[[17,17],[17,17]],colors:Array(32).fill('#fff'),paletteIndices:Array.from({length:16},(_,i)=>16+i),initialGrid:false,colorIndex:(_,v)=>16+(v&15),editable:[[true,false],[true,true]],$refs:{canvas:{setPointerCapture(){},getBoundingClientRect(){return {left:0,top:0,width:2,height:2};}}}};
 Object.assign(editor,options.data.call(editor));for(const [name,method] of Object.entries(options.methods))editor[name]=method.bind(editor);editor.draw=()=>{};
 Object.defineProperties(editor,{width:{get(){return 2;}},height:{get(){return 2;}}});
 editor.tool='fill';editor.ink=1;const event={clientX:0,clientY:0,pointerId:1,preventDefault(){}};editor.down(event);assert.deepEqual(editor.pixels,[[17,17],[17,17]]);
 editor.ink=2;editor.down(event);assert.deepEqual(editor.pixels,[[18,17],[18,18]],'Fill keeps protected context intact and converts ink into the target palette');editor.undo();assert.deepEqual(editor.pixels,[[17,17],[17,17]]);editor.redo();assert.deepEqual(editor.pixels,[[18,17],[18,18]]);
 console.log(`PASS stadium scenes: ${checked} native views, correct flips, protected context, cumulative strokes, repeated pixels, compressed round trips and exact restoration`);
})().catch(e=>{console.error(e);process.exitCode=1;});
