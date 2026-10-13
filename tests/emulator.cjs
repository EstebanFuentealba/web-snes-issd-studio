const assert = require('assert/strict');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
// Exercise the frame lifecycle without fetching a third-party runtime.
const origin = 'http://localhost:3000';
const timers = new Set();
const component = vm.runInNewContext(read('src/components/RomEmulator.vue').match(/<script>([\s\S]*?)<\/script>/)[1]
  .replace('export default', 'module.exports =').replace('import.meta.env.BASE_URL', "'/studio/'"), {
  module: { exports: {} }, window: { location: { origin } },
  setTimeout: fn => { timers.add(fn); return fn; }, clearTimeout: fn => timers.delete(fn),
});
const sent = [];
const frame = { postMessage: (...args) => sent.push(args) };
let gameFocusCount = 0;
const exported = Uint8Array.from({ length: 1024 }, (_, i) => i % 256);
const editor = { ...component.data(), project: { headerSize: 512, exportRom: () => exported.slice() },
  revision: 1, $refs: { frame: { contentWindow: frame, focus: options => { assert.equal(options.preventScroll, true); gameFocusCount++; } } } };
for (const [name, fn] of Object.entries(component.methods)) editor[name] = fn.bind(editor);
editor.start();
assert.equal(editor.frameUrl, '/studio/emulator/index.html');
assert.equal(editor.active, true);
assert.deepEqual(editor.snapshot, exported.slice(512));
editor.sendRom(); editor.sendRom();
assert.equal(sent.length, 1);
assert.equal(sent[0][1], origin);
assert.equal(sent[0][2][0], sent[0][0].bytes.buffer);
assert.deepEqual(exported.slice(0, 512), Uint8Array.from({ length: 512 }, (_, i) => i % 256));
editor.receive({ origin: 'https://untrusted.example', source: frame, data: { type: 'issd:emulator-status', state: 'error' } });
assert.equal(editor.active, true);
editor.receive({ origin, source: {}, data: { type: 'issd:emulator-status', state: 'error' } });
assert.equal(editor.active, true);
editor.receive({ origin, source: frame, data: { type: 'issd:emulator-status', state: 'ready' } });
assert.equal(timers.size, 0);
editor.receive({ origin, source: frame, data: { type: 'issd:emulator-status', state: 'running' } });
assert.equal(gameFocusCount, 1);
assert.equal(sent.at(-1)[0].type, 'issd:focus-game');
assert.equal(sent.at(-1)[1], origin);
editor.revision = 2; editor.start();
assert.equal(editor.loadedRevision, 2);
editor.stop(); assert.equal(timers.size, 0); assert.equal(editor.snapshot, null);
editor.start(); [...timers][0](); assert.equal(editor.active, false); assert.match(editor.error, /conexión/);
editor.project.exportRom = () => { throw Error('ROM inválida'); };
editor.start(); assert.equal(editor.active, false); assert.match(editor.error, /ROM inválida/);

const listeners = {}, reports = [], blobs = [], scripts = [], revoked = [];
const parent = { postMessage: data => reports.push(data) };
const game = { textContent: '' };
const context = { Uint8Array, Blob: require('buffer').Blob, parent, location: { origin },
  URL: { createObjectURL: blob => { blobs.push(blob); return 'blob:rom'; }, revokeObjectURL: url => revoked.push(url) },
  document: { getElementById: () => game, createElement: () => ({}), body: { appendChild: script => scripts.push(script) } },
  window: { focus() {}, addEventListener: (name, fn) => { listeners[name] = fn; } } };
vm.runInNewContext(read('public/emulator/player.js'), context);
const key = (key, options = {}) => {
  let prevented = false;
  listeners.keydown({ key, preventDefault() { prevented = true; }, ...options });
  return prevented;
};
assert.equal(key('ArrowDown'), false);
const load = { origin, source: parent, data: { type: 'issd:load-rom', bytes: Uint8Array.of(1, 2, 3) } };
listeners.message({ ...load, origin: 'https://untrusted.example' }); assert.equal(scripts.length, 0);
listeners.message(load); listeners.message(load);
assert.equal(scripts.length, 1); assert.equal(blobs[0].size, 3);
assert.equal(context.window.EJS_core, 'snes'); assert.equal(context.window.EJS_gameUrl, 'blob:rom');
let runtimeFocusCount = 0;
const runtimeElements = { parent: { focus: options => { assert.equal(options.preventScroll, true); runtimeFocusCount++; } } };
context.window.EJS_emulator = { elements: runtimeElements };
assert.equal(context.window.EJS_noAutoFocus, false);
context.window.EJS_ready(); context.window.EJS_onGameStart();
assert.equal(runtimeFocusCount, 1);
const focusMessage = { origin, source: parent, data: { type: 'issd:focus-game' } };
listeners.message({ ...focusMessage, origin: 'https://untrusted.example' });
listeners.message({ ...focusMessage, source: {} });
assert.equal(runtimeFocusCount, 1);
listeners.message(focusMessage);
assert.equal(runtimeFocusCount, 2);
assert.deepEqual(reports.map(r => r.state), ['ready', 'running']);
for (const control of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ']) assert.equal(key(control), true);
assert.equal(key('a'), false);
assert.equal(key('Enter'), false); // Start remains available to the runtime's own key handler.
assert.equal(key('ArrowDown', { ctrlKey: true }), false);
assert.equal(key('ArrowUp', { target: { closest: () => ({}) } }), false);
scripts[0].onerror(); assert.equal(reports.at(-1).state, 'error');
listeners.pagehide(); assert.deepEqual(revoked, ['blob:rom']);
console.log('PASS emulator: validated snapshot, SMC header removal, reload, origin checks, cleanup and load errors');

// The selected UI language configures the isolated EmulatorJS runtime too.
for (const [language, locale, startName] of [['en', 'en-US', 'Start game'], ['pt', 'pt-BR', 'Iniciar jogo']]) {
  const localizedListeners = {}, localizedGame = { textContent: '' };
  const localized = { ...context,
    document: { documentElement: {}, getElementById: () => localizedGame, createElement: () => ({}), body: { appendChild() {} } },
    window: { addEventListener: (name, fn) => { localizedListeners[name] = fn; } },
  };
  vm.runInNewContext(read('public/emulator/player.js'), localized);
  localizedListeners.message({ ...load, data: { ...load.data, language } });
  assert.equal(localized.window.EJS_language, locale);
  assert.equal(localized.window.EJS_startButtonName, startName);
  assert.equal(localized.document.documentElement.lang, language);
  localizedListeners.error();
  assert.match(localizedGame.textContent, language === 'en' ? /Check your connection/ : /Verifique sua conexão/);
}
console.log('PASS emulator languages: English and Portuguese runtime, start button and load errors');

// Panel commands cross only the trusted frame and always release SNES inputs.
(async()=>{
  const inputs=[],restored=[];let restarts=0;
  context.setTimeout=fn=>{queueMicrotask(fn);};
  context.window.EJS_emulator={elements:runtimeElements,gameManager:{simulateInput:(...args)=>inputs.push(args),restart:()=>restarts++,getState:()=>Uint8Array.of(9,8,7),loadState:bytes=>restored.push(bytes)}};
  const command=(id,action,options={})=>listeners.message({origin,source:parent,data:{type:'issd:emulator-command',id,action,...options}});
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  const focusBeforePulse=runtimeFocusCount;command(1,'press',{player:0,index:8,duration:150});await flush();assert.deepEqual(inputs,[[0,8,1],[0,8,0]]);assert.equal(runtimeFocusCount,focusBeforePulse+1,'Game focus must be restored before each controller pulse');
  command(2,'press',{player:2,index:8,duration:150});await flush();assert.equal(inputs.length,2);assert.equal(reports.at(-1).ok,false);
  listeners.message({origin:'https://untrusted.example',source:parent,data:{type:'issd:emulator-command',id:3,action:'restart'}});assert.equal(restarts,0);
  command(3,'save-screen',{slot:1});await flush();command(4,'load-screen',{slot:1});await flush();assert.deepEqual(restored,[Uint8Array.of(9,8,7)]);
  command(5,'load-screen',{slot:9});await flush();assert.equal(reports.at(-1).ok,false);
  command(6,'press',{player:0,index:3,duration:500});command(7,'cancel');await flush();assert.deepEqual(inputs.slice(2),[[0,3,1],[0,3,0]]);
  command(8,'unknown');await flush();assert.equal(reports.at(-1).ok,false);
  command(9,'restart');await flush();assert.equal(restarts,1);command(9,'restart');await flush();assert.equal(restarts,1);
  editor.project.exportRom=()=>exported.slice();editor.$t=x=>x;editor.start();editor.running=true;
  editor.bookmarkName='EXTRA';editor.saveScreen();const pending=editor.pendingCommand;assert.equal(sent.at(-1)[0].action,'save-screen');
  editor.receive({origin,source:frame,data:{type:'issd:emulator-command-result',id:pending.id+1,ok:true}});assert.equal(editor.busy,true);
  editor.receive({origin,source:frame,data:{type:'issd:emulator-command-result',id:pending.id,ok:true}});assert.deepEqual(JSON.parse(JSON.stringify(editor.screens)),[{slot:1,name:'EXTRA'}]);assert.equal(editor.busy,false);
  const focusBeforePress=gameFocusCount;editor.press(4);
  editor.receive({origin,source:frame,data:{type:'issd:emulator-command-result',id:editor.pendingCommand.id,ok:true}});
  assert.equal(gameFocusCount,focusBeforePress+1);
  editor.stop();assert.equal(editor.screens.length,0);assert.equal(editor.running,false);
  console.log('PASS emulator test panel: controller pulse/release, bounded commands, cancellation, screen save/load, origin checks and ROM lifecycle');
})().catch(error=>{console.error(error);process.exitCode=1;});
