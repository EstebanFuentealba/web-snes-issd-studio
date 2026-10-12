const assert=require('assert/strict'),fs=require('fs'),Vue=require('vue'),{compile}=require('@vue/compiler-dom');
(async()=>{
 const file=__dirname+'/../roms/International Superstar Soccer Deluxe (USA).sfc';
 if(!fs.existsSync(file)){console.log('SKIP formation editor UI: local ROM missing');return;}
 const rom=new Uint8Array(fs.readFileSync(file));
 const source=fs.readFileSync(__dirname+'/../src/components/FormationEditor.vue','utf8');
 const template=source.slice(source.indexOf('<template>')+10,source.lastIndexOf('</template>'));
 const script=source.split('<script>')[1].split('</script>')[0].replace(/^import .*;$/gm,'').replace('export default','return');
 const deps={};for(const name of ['formations','team-count'])Object.assign(deps,await import(`../src/rom/${name}.mjs`));
 const {readDeluxeTeam}=await import('../src/rom/deluxe.mjs'),players=readDeluxeTeam(rom,0).players;
 const options=new Function(...Object.keys(deps),script)(...Object.values(deps));
 options.render=new Function('Vue',compile(template,{mode:'function',prefixIdentifiers:true}).code)({...Vue,vModelText:{},vModelSelect:{}});
 const node=(type,text='')=>({type,text,children:[],props:{},parent:null});
 const renderer=Vue.createRenderer({createElement:type=>node(type),createText:text=>node('text',text),createComment:text=>node('comment',text),setText:(n,text)=>n.text=text,setElementText:(n,text)=>{n.text=text;n.children=[];},patchProp:(n,k,old,value)=>n.props[k]=value,insert(n,p,a){if(n.parent){const i=n.parent.children.indexOf(n);if(i>=0)n.parent.children.splice(i,1);}n.parent=p;const i=a?p.children.indexOf(a):-1;if(i<0)p.children.push(n);else p.children.splice(i,0,n);},remove(n){const i=n.parent?.children.indexOf(n);if(i>=0)n.parent.children.splice(i,1);},parentNode:n=>n.parent,nextSibling:n=>n.parent?.children[n.parent.children.indexOf(n)+1]||null});
 let applied;const root=node('root'),app=renderer.createApp(options,{rom,original:rom,teamIndex:0,players,teamOptions:[{index:0,name:'ITALY'},{index:8,name:'GERMANY'}],modified:false,onApply:p=>applied=p});app.config.globalProperties.$t=v=>v;const warnings=[];app.config.warnHandler=m=>warnings.push(m);
 const editor=app.mount(root),walk=n=>[n,...n.children.flatMap(walk)];
 assert.equal(walk(root).find(n=>n.type==='svg').props.viewBox,'0 0 160 100');
 assert.equal(walk(root).filter(n=>n.props.class?.includes?.('pitch-player')).length,10);
 assert.equal(editor.dirty,false);
 editor.selected=0;editor.setAttack(0,false);assert.equal(editor.draft.slots[0].role,1);assert.equal(editor.dirty,true);
 let stopped=false;editor.keyMove(0,{key:'ArrowRight',preventDefault(){stopped=true;}});assert.ok(stopped);assert.equal(editor.draft.slots[0].depth,editor.current.slots[0].depth+1);
 const editedDepth=editor.draft.slots[0].depth;editor.editOffset('depth',{target:{value:'',checkValidity:()=>false}});assert.equal(editor.draft.slots[0].depth,editedDepth);
 editor.apply();assert.ok(applied);assert.equal(applied.bytes[21],1);assert.equal(applied.bytes[1],editedDepth);
 editor.resetDraft();assert.equal(editor.dirty,false);
 editor.choosePreset(6);assert.equal(editor.draft.label,'3-3-4');editor.apply();assert.equal(applied.bytes[0],6);
 const forward=editor.draft.slots[9].role;editor.setAttack(9,true);assert.equal(editor.draft.slots[9].role,forward);
 editor.source=8;editor.copyOriginal();assert.deepEqual(editor.draft.bytes,deps.readFormation(rom,8).bytes);
 // Pointer coordinates use the SVG inverse transform, with cancellation restoring the draft.
 const before={...editor.draft.slots[0]},capture=new Set();
 Object.assign(editor.$refs.pitch,{setPointerCapture:id=>capture.add(id),hasPointerCapture:id=>capture.has(id),releasePointerCapture:id=>capture.delete(id),getScreenCTM:()=>({inverse:()=>({})}),createSVGPoint:()=>({x:0,y:0,matrixTransform(){return {x:this.x/2,y:this.y/2};}})});
 editor.startDrag(0,{button:0,pointerId:1});editor.moveDrag({pointerId:1,clientX:90,clientY:50});assert.equal(editor.draft.slots[0].depth,15);assert.equal(editor.draft.slots[0].width,-25);
 editor.cancelDrag({pointerId:1});assert.deepEqual(editor.draft.slots[0],before);
 editor.startDrag(0,{button:0,pointerId:2});editor.endDrag({pointerId:2,clientX:2000,clientY:2000});assert.equal(editor.drag,null);assert.equal(editor.draft.slots[0].depth,19);assert.equal(editor.draft.slots[0].width,40);
 await Vue.nextTick();assert.deepEqual(warnings,[]);app.unmount();console.log('PASS formation editor UI: horizontal field, ten named/dorsal tokens, attack controls, keyboard/drag, SVG scaling, cancellation, limits, apply and discard');
})().catch(e=>{console.error(e);process.exitCode=1;});
