const assert=require('assert/strict'),fs=require('fs');
global.crypto ||= require('crypto').webcrypto;
(async()=>{
 const {RomProject}=await import('../src/rom/project.mjs');
 const {activeTeamIds,hasEmptyTeams,TEAM_METADATA}=await import('../src/rom/team-count.mjs');
 const {editableGroups}=await import('../src/rom/group-editor.mjs');
 const {teamNameTexts}=await import('../src/rom/team-labels.mjs');
 const file='roms/International Superstar Soccer Deluxe (USA).sfc';
 if(!fs.existsSync(file)){console.log('SKIP empty teams: local ROM unavailable');return;}
 const original=new Uint8Array(fs.readFileSync(file)),p=await RomProject.create(original);
 p.createEmptyRom();assert.ok(hasEmptyTeams(p.bytes()));assert.deepEqual(activeTeamIds(p.bytes()),[]);assert.deepEqual(editableGroups(p.bytes()),[]);
 const empty=p.exportRom();assert.equal(empty.length,original.length);assert.equal(p.createEmptyRom(),false);
 p.undo();assert.deepEqual(p.exportRom(),original);p.redo();assert.deepEqual(p.exportRom(),empty);
 assert.deepEqual((await RomProject.import(JSON.parse(JSON.stringify(p.record())))).exportRom(),empty);
 const loaded=await RomProject.create(empty);assert.deepEqual(activeTeamIds(loaded.bytes()),[]);
 // Render each editor section with the empty ROM: team-dependent panels
 // must not read an absent squad, even after navigating or undoing.
 const Vue=require('vue'),{parse}=require('@vue/compiler-sfc'),{compile}=require('@vue/compiler-dom');
 const {descriptor}=parse(fs.readFileSync('src/components/StudioEditor.vue','utf8'));
 const deps={};let script=descriptor.script.content;
 for(const match of script.matchAll(/import\s+([^;]+?)\s+from\s+['"]([^'"]+)['"];?/g)){
  const names=match[1].trim(),path=match[2];
  if(path.endsWith('.vue'))deps[names]={render(){return Vue.h('div');}};
  else {const mod=path==='vue'?Vue:await import('../src/components/'+path);for(const name of names.slice(1,-1).split(',').map(s=>s.trim()))deps[name]=mod[name];}
 }
 script=script.replace(/import\s+([^;]+?)\s+from\s+['"]([^'"]+)['"];?/g,'').replace('export default','return');
 const options=new Function(...Object.keys(deps),script)(...Object.values(deps));
 const data=options.data;options.data=()=>({...data(),project:Vue.markRaw(loaded),rom:Vue.markRaw(loaded.bytes())});
 options.mounted=function(){this.refresh();};options.beforeUnmount=()=>{};
 options.render=new Function('Vue',compile(descriptor.template.content,{mode:'function',prefixIdentifiers:true}).code)({...Vue,vModelText:{},vModelSelect:{},vModelCheckbox:{},vModelDynamic:{},vShow:{}});
 const node=(type,text='')=>({type,text,children:[],props:{},parent:null});
 const renderer=Vue.createRenderer({createElement:type=>node(type),createText:text=>node('text',text),createComment:text=>node('comment',text),setText:(n,t)=>n.text=t,setElementText:(n,t)=>{n.text=t;n.children=[];},patchProp:(n,k,o,v)=>n.props[k]=v,insert(n,p,a){n.parent=p;const i=a?p.children.indexOf(a):-1;if(i<0)p.children.push(n);else p.children.splice(i,0,n);},remove(n){const i=n.parent?.children.indexOf(n);if(i>=0)n.parent.children.splice(i,1);},parentNode:n=>n.parent,nextSibling:n=>n.parent?.children[n.parent.children.indexOf(n)+1]||null});
 const root=node('root'),app=renderer.createApp(options),errors=[];app.config.globalProperties.$t=v=>v;app.config.globalProperties.$locale='es';app.config.errorHandler=e=>errors.push(e);app.config.warnHandler=()=>{};
 const editor=app.mount(root),walk=n=>[n,...n.children.flatMap(walk)];await Vue.nextTick();
 for(const section of Object.keys(editor.sections)){editor.section=section;await Vue.nextTick();}
 assert.deepEqual(errors,[]);assert.equal(editor.team,null);
 assert.ok(walk(root).some(n=>n.type==='button'&&n.text==='Crear ROM sin equipos'));
 editor.section='teams';await Vue.nextTick();assert.ok(walk(root).some(n=>n.type==='button'&&n.text==='Agregar equipo'));
 assert.ok(!walk(root).some(n=>n.type==='h2'&&n.text.includes('Información general')));
 app.unmount();
 const prior=loaded.exportRom();assert.throws(()=>loaded.addTeam('123'),/equipo|nombre|letras/i);assert.deepEqual(loaded.exportRom(),prior);
 loaded.addTeam('PRUEB');assert.deepEqual(activeTeamIds(loaded.bytes()),[0]);assert.equal(teamNameTexts(loaded.original,loaded.bytes(),0).large,'PRUEB');
 loaded.addTeam('COLO COLO');assert.deepEqual(activeTeamIds(loaded.bytes()),[0,21]);
 const populatedApp=renderer.createApp(options);populatedApp.config.globalProperties.$t=v=>v;populatedApp.config.globalProperties.$locale='es';populatedApp.config.errorHandler=e=>errors.push(e);populatedApp.config.warnHandler=()=>{};
 const populatedRoot=node('root'),populated=populatedApp.mount(populatedRoot);await Vue.nextTick();
 for(const section of ['teams','players','appearance','graphics']){populated.section=section;await Vue.nextTick();}
 assert.deepEqual(errors,[]);assert.equal(populated.team.players.length,20);
 populated.section='teams';await Vue.nextTick();
 assert.deepEqual(populated.teamOptions.map(o=>[o.index,o.number]),[[0,1],[21,2]]);
 assert.ok(walk(populatedRoot).some(n=>n.type==='option'&&n.props.value===21&&n.text==='2. COLO COLO'));
 loaded.deleteTeam(0);populated.refresh();await Vue.nextTick();
 assert.deepEqual(populated.teamOptions.map(o=>[o.index,o.number]),[[21,1]]);
 assert.ok(walk(populatedRoot).some(n=>n.type==='option'&&n.props.value===21&&n.text==='1. COLO COLO'));
 populated.section='players';await Vue.nextTick();assert.equal(populated.teamOptions[0].number,1);
 loaded.undo();populated.refresh();await Vue.nextTick();assert.deepEqual(errors,[]);populatedApp.unmount();
 const filled=loaded.exportRom();assert.deepEqual((await RomProject.import(loaded.record())).exportRom(),filled);
 loaded.createEmptyRom();assert.deepEqual(activeTeamIds(loaded.bytes()),[]);loaded.undo();assert.deepEqual(loaded.exportRom(),filled);loaded.redo();loaded.exportRom();
 // A longer first name must select a compatible frame instead of failing on
 // the hidden seed's original sprite budget.
 const wide=await RomProject.create(empty);wide.addTeam('HOLLAND');assert.equal(activeTeamIds(wide.bytes()).length,1);
 const id=activeTeamIds(wide.bytes())[0];assert.equal(teamNameTexts(wide.original,wide.bytes(),id).large,'HOLLAND');wide.exportRom();
 wide.createEmptyRom();const extraEmpty=await RomProject.create(wide.exportRom());extraEmpty.addTeam('PERU');extraEmpty.exportRom();assert.equal(activeTeamIds(extraEmpty.bytes()).length,1);
 const tampered=empty.slice();tampered[TEAM_METADATA+6]=2;assert.throws(()=>new RomProject(tampered),/Cantidad/);
 console.log('PASS empty teams: zero active squads/groups, first and subsequent creation, wide names, repeat clearing, atomic rejection, undo/redo, project and ROM recovery');
})().catch(e=>{console.error(e);process.exitCode=1;});
