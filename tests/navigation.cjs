const assert = require('assert/strict');
const fs = require('fs');
const Vue = require('vue');
const { parse } = require('@vue/compiler-sfc');
const { createRouter, createMemoryHistory, RouterView, isNavigationFailure } = require('vue-router');

// Load the real component options with imports supplied or stubbed; no ROM is
// needed to exercise routing and the existing pending-edit guards.
async function options(file, stubs = false, overrides = {}) {
  let script = parse(fs.readFileSync(file, 'utf8')).descriptor.script.content;
  const deps = {};
  for (const match of script.matchAll(/import\s+([^;]+?)\s+from\s+['"]([^'"]+)['"];?/g)) {
    const names = match[1].trim(), source = match[2];
    const mod = source === 'vue' ? Vue : !stubs && source.endsWith('.mjs')
      ? await import('../src/components/' + source) : {};
    if (names.startsWith('{')) {
      for (const name of names.slice(1, -1).split(',').map(s => s.trim())) deps[name] = mod[name];
    } else deps[names] = { render: () => Vue.h('div') };
  }
  script = script.replace(/import\s+([^;]+?)\s+from\s+['"]([^'"]+)['"];?/g, '').replace('export default', 'return');
  Object.assign(deps,overrides);
  return new Function(...Object.keys(deps), script)(...Object.values(deps));
}

(async () => {
  const { STUDIO_SECTIONS, MENU_TABS, sectionLocation, studioRoutes } = await import('../src/navigation.mjs');
  const studio = await options('src/components/StudioEditor.vue');
  const menus = await options('src/components/MenusEditor.vue');
  const home = await options('src/views/Home.vue', true);
  assert.ok(home.components.StudioEditor);
  assert.ok(!home.components.ExternalStudioEditor,'All ISSD layouts use the same Studio');
  const wcFile=require('path').join(require('os').homedir(),'Downloads/ISSDWC26RC1GB2.0.sfc');
  if(fs.existsSync(wcFile)){
    global.crypto ||= require('crypto').webcrypto;
    const {RomProject}=await import('../src/rom/project.mjs');
    const project=await RomProject.create(new Uint8Array(fs.readFileSync(wcFile)));
    const vm={...studio.data(),project,rom:project.bytes(),$refs:{},$t:s=>s};
    for(const [name,get] of Object.entries(studio.computed))if(typeof get==='function')Object.defineProperty(vm,name,{get:()=>get.call(vm)});
    for(const [name,fn] of Object.entries(studio.methods))vm[name]=fn.bind(vm);
    vm.refresh();
    const groupEditor=await options('src/components/GroupEditor.vue');
    const {wc26TeamPresentation}=await import('../src/rom/wc26-data.mjs');
    const {flagMatrix}=await import('../src/rom/graphics.mjs');
    const artwork=groupEditor.computed.artwork.call({rom:vm.rom,groups:vm.groups});
    for(let i=0;i<56;i++){
      const expected=wc26TeamPresentation(vm.rom,i);
      assert.deepEqual(artwork[i].flag.matrix,expected.flag,`Group flag slot ${i} must use its own directory entry`);
      assert.deepEqual(flagMatrix(vm.rom,i),expected.flag,`Shared flag reader slot ${i}`);
      assert.deepEqual(artwork[i].flag.colors,expected.colors,`Group palette slot ${i}`);
      assert.ok(expected.flag.flat().every(pixel=>expected.colors[pixel]&&(!pixel||expected.colors[pixel]!=='transparent')),`All flag inks resolve in slot ${i}`);
    }
    assert.equal(artwork[12].flag.colors[5],'#ffef10','Senegal shared yellow');
    assert.equal(artwork[47].flag.colors[6],'#de0019','Panama shared red');
    assert.notDeepEqual(artwork[48].flag.matrix,artwork[0].flag.matrix,'Italy must not reuse Spain');
    assert.equal(vm.teams.length,56);assert.equal(vm.teams[55],'PERU');assert.equal(vm.playerTeams.length,56);assert.equal(vm.groups.length,14);
    assert.equal(vm.team.players.length,20);assert.equal(vm.playerNameLength,10);assert.ok(vm.uniformMatrix.length);assert.deepEqual(vm.uniformMatrix,vm.originalUniformMatrix);
    assert.ok(vm.resources.length>=30);assert.ok(vm.resources.every(r=>!r.readOnly));assert.equal(vm.graphic.kind,'flag');assert.equal(vm.scenarios.length,12);assert.equal(vm.stadiums.length,8);assert.ok(vm.compatibility.menus.supported);
    vm.teamIndex=55;vm.refresh();assert.equal(vm.team.players.length,20);assert.ok(vm.uniformMatrix.length);assert.equal(vm.groupTeamNames[55],'PERU');
  }
  const component = { render: () => Vue.h('div') };
  const makeRouter = (view = component) => createRouter({ history: createMemoryHistory(), routes: studioRoutes(view) });
  const router = makeRouter();
  for (const section of Object.keys(STUDIO_SECTIONS)) {
    await router.push(sectionLocation(section));
    assert.equal(router.currentRoute.value.meta.section, section);
    const restored = makeRouter();
    await restored.push(router.currentRoute.value.fullPath);
    const editor = { $route: restored.currentRoute.value };
    studio.created.call(editor);
    assert.equal(editor.section, section, `Reload ${section}`);
  }
  for (const tab of MENU_TABS) {
    await router.push({ name: `menu-${tab.id}` });
    const restored = makeRouter();
    await restored.push(router.currentRoute.value.fullPath);
    assert.equal(menus.computed.active.get.call({ $route: restored.currentRoute.value }), tab.id);
  }
  await router.push('/menus');
  assert.equal(router.currentRoute.value.path, '/menus/main');
  await router.push('/missing');
  assert.equal(router.currentRoute.value.path, '/');

  // User-initiated ROM loads reset the route before the next editor mounts.
  const loadingHome=await options('src/views/Home.vue',true,{
    markRaw:Vue.markRaw,openRom:()=>({game:'issd',layout:'native'}),readTeam:async()=>({players:[]}),teamNames:()=>['Team'],
  });
  const vm={loadVersion:0,$router:router,storage:{database:null},clearAudio(){}};
  const file={arrayBuffer:async()=>new Uint8Array([1]).buffer};
  await router.push(sectionLocation('players'));
  await loadingHome.methods.loadFile.call(vm,file,true);
  assert.equal(router.currentRoute.value.name,'Home');assert.equal(vm.session.game,'issd');
  // Restoring the saved ROM on refresh keeps the user's deep link.
  await router.push(sectionLocation('audio'));
  await loadingHome.methods.loadFile.call(vm,file,false);
  assert.equal(router.currentRoute.value.meta.section,'audio');

  // Render RouterView to verify all child routes retain the same Home instance
  // and that real component guards can cancel buttons and history navigation.
  let allowed = true, prompts = 0, mounts = 0;
  const guarded = {
    beforeRouteUpdate: home.beforeRouteUpdate,
    beforeRouteLeave: home.beforeRouteLeave,
    mounted() { mounts++; },
    render() { return Vue.h({ methods: { allowNavigate() { prompts++; return allowed; } }, render: () => Vue.h('div') }, { ref: 'editor' }); },
  };
  const node = () => ({ children: [], parent: null });
  const renderer = Vue.createRenderer({
    createElement: node, createText: node, createComment: node,
    setText() {}, setElementText() {}, patchProp() {},
    insert(n, p) { n.parent = p; p.children.push(n); },
    remove(n) { const i = n.parent?.children.indexOf(n); if (i >= 0) n.parent.children.splice(i, 1); },
    parentNode: n => n.parent, nextSibling: () => null,
  });
  const live = makeRouter(guarded);
  await live.push('/players');
  const app = renderer.createApp({ render: () => Vue.h(RouterView) });
  app.use(live); app.mount(node()); await Vue.nextTick();
  allowed = false;
  assert.ok(isNavigationFailure(await live.push('/audio')));
  assert.equal(live.currentRoute.value.path, '/players');
  allowed = true;
  await live.push('/menus/training'); await Vue.nextTick();
  const beforeTabs = prompts;
  await live.push('/menus/game'); await Vue.nextTick();
  assert.equal(prompts, beforeTabs, 'Tab changes preserve drafts without a discard prompt');
  assert.equal(mounts, 1, 'Navigation must preserve the loaded ROM and Home instance');
  const go = delta => new Promise(resolve => { const stop = live.afterEach((to, from, failure) => { stop(); resolve(failure); }); live.go(delta); });
  await go(-1); await Vue.nextTick();
  assert.equal(live.currentRoute.value.meta.menuTab, 'training');
  allowed = false;
  assert.ok(isNavigationFailure(await go(-1)));
  assert.equal(live.currentRoute.value.path, '/menus/training');
  app.unmount();
  console.log('PASS navigation: all sections and menu tabs restore from URLs, retain Home, support history, and protect pending edits');
})().catch(error => { console.error(error); process.exitCode = 1; });
