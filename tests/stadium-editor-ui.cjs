const assert=require('assert/strict'),fs=require('fs');
const Vue=require('vue'),{compile}=require('@vue/compiler-dom');
(async()=>{
 const file=__dirname+'/../roms/International Superstar Soccer Deluxe (USA).sfc';
 if(!fs.existsSync(file)){console.log('SKIP stadium editor UI: local ROM missing');return;}
 const rom=new Uint8Array(fs.readFileSync(file));
 const source=fs.readFileSync(__dirname+'/../src/components/StadiumEditor.vue','utf8');
 const template=source.split('<template>')[1].split('</template>')[0];
 const script=source.split('<script>')[1].split('</script>')[0].replace(/^import .*;$/gm,'').replace('export default','return');
 let pixels;
 const deps={RomImage:{render(){return Vue.h('canvas');}},PixelEditor:{props:['matrix','original','colors','editable','normalizeEdit','colorIndex','pixelColor','originalPixelColor'],render(){pixels=this.$props;return Vue.h('canvas',{'data-editor':'stadium'});}}};
 for(const module of ['binary','team-labels','stadiums','stadium-scene'])Object.assign(deps,await import(`../src/rom/${module}.mjs`));
 const options=new Function(...Object.keys(deps),script)(...Object.values(deps));
 options.render=new Function('Vue',compile(template,{mode:'function',prefixIdentifiers:true}).code)({...Vue,vModelText:{},vModelSelect:{}});
 const node=(type,text='')=>({type,text,children:[],props:{},parent:null});
 const renderer=Vue.createRenderer({
  createElement:type=>node(type),createText:text=>node('text',text),createComment:text=>node('comment',text),
  setText:(n,text)=>n.text=text,setElementText:(n,text)=>{n.text=text;n.children=[];},
  patchProp:(n,key,old,value)=>n.props[key]=value,
  insert(n,parent,anchor){if(n.parent){const i=n.parent.children.indexOf(n);if(i>=0)n.parent.children.splice(i,1);}n.parent=parent;const i=anchor?parent.children.indexOf(anchor):-1;if(i<0)parent.children.push(n);else parent.children.splice(i,0,n);},
  remove(n){const i=n.parent?.children.indexOf(n);if(i>=0)n.parent.children.splice(i,1);},
  parentNode:n=>n.parent,nextSibling:n=>n.parent?.children[n.parent.children.indexOf(n)+1]||null,
 });
 const root=node('root'),app=renderer.createApp(options,{rom,original:rom,modified:[]});app.config.globalProperties.$t=v=>v;const warnings=[];app.config.warnHandler=message=>warnings.push(message);
 const editor=app.mount(root),walk=n=>[n,...n.children.flatMap(walk)];
 assert.ok(walk(root).some(n=>n.type==='h3'&&n.text==='Diseños y colores'),'The design section must actually render, not remain inside an HTML comment');
 assert.ok(walk(root).some(n=>n.props.class==='resource-cards'),'Visual resource navigation is present');
 assert.ok(pixels?.editable&&pixels.normalizeEdit&&pixels.colorIndex,'The visual canvas is connected to protected native source editing');
 assert.deepEqual(pixels.matrix,editor.view.matrix);assert.notDeepEqual(pixels.matrix,editor.graphic.matrix);
 editor.selectResource(editor.graphics.find(g=>g.address===0x9990a0).id);await Vue.nextTick();
 assert.equal(typeof pixels.pixelColor,'function');assert.equal(typeof pixels.originalPixelColor,'function');
 let edge;editor.view.matrix.some((row,y)=>row.some((v,x)=>{if(editor.view.owners[y][x]&&(v&15)===0&&typeof editor.view.underlays[y][x]==='number'){edge={x,y,v};return true;}return false;}));assert.ok(edge);
 assert.equal(pixels.pixelColor(edge.v,edge.x,edge.y,pixels.colors),editor.view.colors[editor.view.underlays[edge.y][edge.x]],'The rendered editor is wired to transparent foreground composition');
 editor.toggleTiles();await Vue.nextTick();assert.deepEqual(pixels.matrix,editor.graphic.matrix);assert.equal(pixels.editable,undefined);
 editor.selectResource(editor.graphics.find(g=>g.address===0xa185ba).id);await Vue.nextTick();assert.equal(editor.advancedTiles,false);assert.equal(editor.views.length,3);assert.deepEqual(pixels.matrix,editor.view.matrix);
 editor.chooseView({target:{value:'1'}});await Vue.nextTick();assert.equal(editor.viewIndex,1);assert.deepEqual(pixels.matrix,editor.views[1].matrix);
 assert.deepEqual(warnings,[]);app.unmount();console.log('PASS stadium editor UI: rendered design section, resource thumbnails, assembled canvas, protected editing, advanced toggle and weather view navigation');
})().catch(e=>{console.error(e);process.exitCode=1;});
