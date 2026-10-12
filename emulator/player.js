// Each iframe owns one runtime. Removing it stops the core, sound and input handlers.
(() => {
  let romUrl = null, running = false, busy = false, generation = 0, lastCommandId = 0;
  const screens = new Map(), held = new Map();
  const messages = {
    es: { locale: 'es-ES', title: 'ISSD · Emulador SNES', preparing: 'Preparando ROM modificada…', start: 'Iniciar juego', error: 'No se pudo cargar el motor SNES. Revisa tu conexión y vuelve a intentarlo.' },
    pt: { locale: 'pt-BR', title: 'ISSD · Emulador SNES', preparing: 'Preparando ROM modificada…', start: 'Iniciar jogo', error: 'Não foi possível carregar o motor SNES. Verifique sua conexão e tente novamente.' },
    en: { locale: 'en-US', title: 'ISSD · SNES emulator', preparing: 'Preparing modified ROM…', start: 'Start game', error: 'Could not load the SNES engine. Check your connection and try again.' },
  };
  const requested = typeof URLSearchParams === 'function' ? new URLSearchParams(location.search).get('lang') : 'es';
  let language = Object.hasOwnProperty.call(messages, requested) ? requested : 'es';
  const updateLanguage = () => {
    document.documentElement && (document.documentElement.lang = language);
    document.title = messages[language].title;
    document.getElementById('game').textContent = messages[language].preparing;
  };
  updateLanguage();
  const report = (state, message) => parent.postMessage({ type: 'issd:emulator-status', state, message }, location.origin);
  const focusGame = () => window.EJS_emulator?.elements?.parent?.focus({ preventScroll: true });
  const fail = () => {
    document.getElementById('game').textContent = messages[language].error;
    report('error', messages[language].error);
  };
  // Keep game controls from scrolling the containing page, without hiding them
  // from EmulatorJS or interfering with its keyboard configuration fields.
  window.addEventListener('keydown', event => {
    if (!running || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
  }, true);
  window.addEventListener('message', event => {
    if (event.data?.type === 'issd:focus-game') {
      if (running && event.source === parent && event.origin === location.origin) focusGame();
      return;
    }
    if(event.data?.type === 'issd:emulator-command'){handleCommand(event);return;}
    if (event.source !== parent || event.origin !== location.origin || event.data?.type !== 'issd:load-rom' || romUrl) return;
    language = Object.hasOwnProperty.call(messages, event.data.language) ? event.data.language : language;
    updateLanguage();
    const bytes = event.data.bytes;
    if (!(bytes instanceof Uint8Array) || !bytes.length) { fail(); return; }
    romUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
    Object.assign(window, {
      EJS_player: '#game', EJS_core: 'snes', EJS_gameUrl: romUrl,
      EJS_gameName: 'ISSD-editado', EJS_pathtodata: 'https://cdn.emulatorjs.org/stable/data/',
      EJS_language: messages[language].locale, EJS_color: '#176be0', EJS_backgroundColor: '#101820',
      EJS_startOnLoaded: false, EJS_startButtonName: messages[language].start, EJS_threads: false,
      EJS_disableLocalStorage: true, EJS_noAutoFocus: false,
      EJS_ready: () => report('ready'), EJS_onGameStart: () => { running = true; focusGame(); report('running'); },
    });
    const loader = document.createElement('script');
    loader.src = `${window.EJS_pathtodata}loader.js`;
    loader.onerror = fail;
    document.body.appendChild(loader);
  });
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const release = () => {
    for(const key of held.keys()){const [player,index]=key.split(':').map(Number);window.EJS_emulator.gameManager.simulateInput(player,index,0);}
    held.clear();
  };
  const pulse = async (manager,player,index,duration,token) => {
    if(token !== generation)throw new Error('cancelled');
    const key = `${player}:${index}`; held.set(key,token);manager.simulateInput(player,index,1);
    try { await wait(duration); }
    finally { if(held.get(key) === token){manager.simulateInput(player,index,0);held.delete(key);} }
    if(token !== generation)throw new Error('cancelled');
  };
  const handleCommand = event => {
    if(event.source !== parent || event.origin !== location.origin || event.data?.type !== 'issd:emulator-command')return;
    const data=event.data,id=data.id;
    if(!Number.isSafeInteger(id)||id<=lastCommandId)return;
    lastCommandId=id;
    const respond=ok=>parent.postMessage({type:'issd:emulator-command-result',id,ok},location.origin);
    if(!running || !window.EJS_emulator?.gameManager){respond(false);return;}
    if(data.action === 'cancel'){generation++;release();busy=false;respond(true);return;}
    if(busy){respond(false);return;}
    const manager=window.EJS_emulator.gameManager,token=++generation;busy=true;
    (async()=>{
      if(data.action === 'press'){
        if(![0,1].includes(data.player)||![0,1,2,3,4,5,6,7,8,9,10,11].includes(data.index)||!Number.isInteger(data.duration)||data.duration<50||data.duration>1500)throw new Error('input');
        await pulse(manager,data.player,data.index,data.duration,token);
      }else if(data.action === 'restart')manager.restart();
      else if(data.action === 'save-screen'){
        if(!Number.isInteger(data.slot)||data.slot<1||data.slot>8)throw new Error('slot');
        const bytes=await manager.getState();
        if(token!==generation||!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>16*1024*1024)throw new Error('state');
        screens.set(data.slot,bytes.slice());
      }else if(data.action === 'load-screen'){
        if(!screens.has(data.slot))throw new Error('slot');
        manager.loadState(screens.get(data.slot).slice());
      }else throw new Error('command');
      respond(true);
    })().catch(()=>respond(false)).finally(()=>{if(token===generation)busy=false;});
  };
  window.addEventListener('error', fail);
  window.addEventListener('unhandledrejection', fail);
  window.addEventListener('pagehide', () => { generation++; if(running)release(); screens.clear(); if (romUrl) URL.revokeObjectURL(romUrl); });
})();
