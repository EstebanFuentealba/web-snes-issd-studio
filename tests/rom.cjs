const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildSync } = require('esbuild');
global.Blob ||= require('buffer').Blob;

(async () => {
  const { openRom, word, loRom, decompress, tiles } = await import('../src/rom/binary.mjs');
  const { readDeluxeTeam, DELUXE_TEAMS, deluxeAttributes } = await import('../src/rom/deluxe.mjs');
  const { AUDIO_SAMPLES, DEFAULT_SAMPLE_RATE, decodeBrr, readAudioSample, wavBlob } = await import('../src/rom/audio.mjs');
  const { deluxeAppearance } = await import('../src/rom/appearance.mjs');
  const block = payload => Uint8Array.from([payload.length + 2, 0, ...payload]);
  assert.deepEqual([...decompress(block([0x83, 1, 2, 3, 0xc1, 7, 0xe0, 0xa0, 8, 9]), 0)], [1, 2, 3, 7, 7, 7, 0, 0, 0, 8, 0, 9]);
  assert.deepEqual([...decompress(block([0x83, 1, 2, 3, 0x07, 0xdf]), 0)], [1, 2, 3, 1, 2, 3]);
  assert.deepEqual([...decompress(block([0xff, 255]), 0)], new Array(257).fill(0));
  assert.throws(() => decompress(block([0x84, 1]), 0), /truncado/);
  const packed = block([0x90, ...Array.from({length:16}, (_,i)=>i)]); packed[1] |= 0x80;
  assert.deepEqual([...decompress(packed, 0)], [0,8,1,9,2,10,3,11,4,12,5,13,6,14,7,15]);
  const planar = new Uint8Array(32); planar[0] = 0x80; planar[1] = 0x40; planar[16] = 0x20; planar[17] = 0x10;
  assert.deepEqual(tiles(planar,4,1)[0], [1,2,4,8,0,0,0,0]);
  assert.equal(loRom(0xa7e4cf), 0x13e4cf);
  assert.throws(() => loRom(0x7e1000));
  assert.throws(() => openRom(new Uint8Array(200)), /compatible/);
  assert.deepEqual([...decodeBrr(Uint8Array.from([0x01, 0x1f, ...new Array(7).fill(0)]))].slice(0, 2), [0, -2]);
  assert.throws(() => decodeBrr(new Uint8Array(8)), /incompleta/);
  // Intermediate END flags mark streaming fragment boundaries, not the end of the clip.
  const fragment = Uint8Array.from([1,...new Array(8).fill(0),1,...new Array(8).fill(0)]);
  assert.equal(decodeBrr(fragment).length,16); assert.equal(decodeBrr(fragment,true).length,32);
  const attrs = deluxeAttributes(Uint8Array.from([0x89,0x76,0x54,0x32,0x19,0x13,0x1d]));
  assert.equal(attrs.speed,10); assert.equal(attrs.position,1); assert.equal(attrs.no,20); assert.equal(attrs.hair,13);
  const wav = new DataView(await wavBlob(Int16Array.from([123,-456]),16000).arrayBuffer());
  assert.equal(wav.getUint32(24,true),16000); assert.equal(wav.getUint32(40,true),4); assert.equal(wav.getInt16(46,true),-456);
  assert.equal(DEFAULT_SAMPLE_RATE,8000);

  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'iss-studio-tests-'));
  const bundle = path.join(temporary, 'studio.cjs');
  try {
    buildSync({entryPoints:[path.resolve(__dirname,'../src/rom/studio.js')],bundle:true,platform:'node',format:'cjs',outfile:bundle});
    const { readTeam, teamNames } = require(bundle);
    let checked = 0;
    for (const [filename, game, count, squad] of [
      ['International Superstar Soccer (USA).sfc','iss',27,15],
      ['International Superstar Soccer Deluxe (USA).sfc','issd',42,20],
    ]) {
      const file = path.resolve(__dirname, '../roms', filename);
      if (!fs.existsSync(file)) { console.log(`SKIP local ROM: ${filename}`); continue; }
      const bytes = fs.readFileSync(file), session = openRom(bytes);
      assert.equal(session.game,game); assert.equal(teamNames(game).length,count);
      const headered = openRom(Buffer.concat([Buffer.alloc(512),bytes]));
      assert.equal(headered.headerSize,512); assert.deepEqual(headered.rom,session.rom);
      assert.throws(() => openRom(bytes.subarray(0,bytes.length-1)), /Tamaño/);
      const wrongRegion = Uint8Array.from(bytes); wrongRegion[0x7fd9]=2;
      if(game==='issd')assert.equal(openRom(wrongRegion).isHack,true);else assert.throws(() => openRom(wrongRegion), /región/);
      const originalLog = console.log;
      try {
        console.log = () => {};
        for (let index=0;index<count;index++) {
          const team = await readTeam(session,index);
          assert.equal(team.players.length,squad);
          assert.ok(team.players.every(p=>p.name && !/[�#]/.test(p.name)));
          assert.equal(team.flag.length,16); assert.equal(team.flag[0].length,24);
          assert.equal(team.teamMatrix.length,8); assert.equal(team.teamMatrix[0].length,32);
          assert.ok(team.flag.flat().every(pixel=>team.colors[pixel]));
          if(game==='issd') {
            assert.ok(team.players.every(p => /^#[0-9a-f]{6}$/.test(p.skinColor)));
            assert.ok(team.players.every(p => p.head.length===8 && p.head.every(row => row.length===8)));
            assert.ok(team.players.every(p => p.head.flat().every(pixel => p.headColors[pixel])));
            assert.equal(team.players[0].position,1);
            assert.deepEqual([...new Set(team.players.map(p=>p.no))].sort((a,b)=>a-b),Array.from({length:20},(_,i)=>i+1));
          }
        }
      } finally {console.log=originalLog;}
      if(game==='issd') {
        const italy = readDeluxeTeam(session.rom,0), germany = readDeluxeTeam(session.rom,8);
        assert.equal(italy.players[0].name,'Pagani'); assert.equal(germany.players[0].name,'Wagner');
        const normal = deluxeAppearance(session.rom,2,{position:2,skin:0,hair:0});
        const special = deluxeAppearance(session.rom,2,{position:2,skin:1,hair:0});
        assert.notEqual(normal.skinColor,special.skinColor);
        const differentHair = deluxeAppearance(session.rom,2,{position:2,skin:0,hair:13});
        assert.notDeepEqual(normal.head,differentHair.head);
        // Real palette orientation: Italy green, white, red from left to right.
        assert.deepEqual([0,8,16].map(x=>italy.colors[italy.flag[0][x]]),['#009400','#f7f7f7','#ff1010']);
        // Follow the cartridge roster pointer rather than hard-code a flat name table.
        const relocated = session.rom.slice(); relocated.set(relocated.slice(0x3818e,0x3822e),0x3fc40);
        relocated[0x38138]=0x40; relocated[0x38139]=0xfc;
        assert.deepEqual(readDeluxeTeam(relocated,0).players,italy.players);
        for(const sample of AUDIO_SAMPLES) {
          const pcm = readAudioSample(session.rom,sample);
          assert.ok(pcm.length > 0); assert.ok(pcm.some(value=>value!==0));
        }
        const titlePcm = readAudioSample(session.rom,AUDIO_SAMPLES.find(s=>s.name==='TitleScreenNameDrop'));
        assert.equal(titlePcm.length,40544);
        const titleWav = new DataView(await wavBlob(titlePcm,DEFAULT_SAMPLE_RATE).arrayBuffer());
        assert.equal(titleWav.getUint32(40,true) / titleWav.getUint32(28,true),5.068);
      }
      checked+=count;
      console.log(`PASS ${game}: ${count} teams, ${count*squad} players${game==='issd'?`, ${AUDIO_SAMPLES.length} BRR samples`:''}`);
    }
    console.log(`PASS binary, BRR, WAV and ${checked} local ROM teams`);
  } finally {fs.rmSync(temporary,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
