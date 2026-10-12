const assert = require('assert/strict');
const fs = require('fs');
const Vue = require('vue');
const { parse } = require('@vue/compiler-sfc');
const { createRouter, createMemoryHistory, RouterView, isNavigationFailure } = require('vue-router');

// Load the real component options with imports supplied or stubbed; no ROM is
// needed to exercise routing and the existing pending-edit guards.
async function options(file, stubs = false) {
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
  return new Function(...Object.keys(deps), script)(...Object.values(deps));
}

(async () => {
  const { STUDIO_SECTIONS, MENU_TABS, sectionLocation, studioRoutes } = await import('../src/navigation.mjs');
  const studio = await options('src/components/StudioEditor.vue');
  const menus = await options('src/components/MenusEditor.vue');
  const home = await options('src/views/Home.vue', true);
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
