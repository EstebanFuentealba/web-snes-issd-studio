import {hasLongAudio} from './audio-long-format.mjs';
import {hasExpandedTeams,EXPANDED_ROM_SIZE,EXPANDED_TABLES,EXPANDED_TEAMS} from './expanded-layout.mjs';
import { externalDeluxeLayout } from './external-layout.mjs';
export function word(rom, offset) {
  if (!Number.isInteger(offset) || offset < 0 || offset + 2 > rom.length) throw new Error('Dirección fuera de la ROM.');
  return rom[offset] | (rom[offset + 1] << 8);
}

export function loRom(address) {
  if ((address & 0xffff) < 0x8000) throw new Error('Dirección LoROM inválida.');
  return ((address >>> 16) & 0x7f) * 0x8000 + (address & 0x7fff);
}

// Independent engine routines survive common data/graphics/voice hacks. A title
// or file extension alone is insufficient to identify an erased/changed header.
// Accept bank-aligned 2–4 MiB hacks only when the native tables remain readable;
// individual graphic dimensions are checked separately by the editor.
const ISSD_ENGINE_ANCHORS = [
  [0, [0x18,0xfb,0x78,0xd8,0xc2,0x30,0xa2,0xaf,0x01,0x9a,0xc2,0x30,0x8b,0xa9,0x00,0x00]],
  [0x20000, [0x9c,0xe0,0x11,0xa9,0x90,0x1b,0x5b,0x22,0xa9,0xdc,0x80,0xa9,0x00,0x00,0x5b,0xa5]],
  [0x30000, [0xa2,0x00,0x00,0xa0,0x00,0x00,0x48,0xda,0xa9,0x92,0x80,0xa2,0x86,0x00,0x22,0xa3]],
];
function compatibleDeluxeHack(rom) {
  const expanded=hasExpandedTeams(rom)&&rom.length===EXPANDED_ROM_SIZE&&rom[0x7fd7]===12;
  if ((rom.length < 0x200000 || rom.length > EXPANDED_ROM_SIZE || rom.length % 0x8000 !== 0) || ISSD_ENGINE_ANCHORS.filter(([offset, bytes]) => bytes.every((b,i) => rom[offset+i] === b)).length < 2) return false;
  if(expanded){
    try{
      const count=rom[0x187e05];if(count<42||count>EXPANDED_TEAMS)return false;
      for(let t=0;t<count;t++){
        if(rom[0x187e08+(t>>>3)]&(1<<(t&7)))continue;
        for(const [table,bank,parts,size] of [[0xe730,0xc5,2,96],[0xe6c1,0xc6,1,64]])for(let p=0;p<parts;p++)if(decompress(rom,loRom(bank<<16|word(rom,loRom(EXPANDED_TABLES[table])+t*parts*2+p*2))).length!==size)return false;
      }
      return true;
    }catch{return false;}
  }
  if(externalDeluxeLayout(rom,true))return true;
  try {
    const fits = (bank, pointer, size) => {
      const offset = loRom(bank << 16 | pointer);
      if (offset + size > rom.length) throw new Error('Recurso fuera de la ROM.');
      return offset;
    };
    for (let team = 0; team < 42; team++) {
      if (team < 36) fits(0x87, word(rom, 0x38138 + team*2), 160);
      fits(0x8b, word(rom, 0x5ef48 + team*2), 31);
      for (const table of [0x1027a, 0x102d0, 0x10326, 0x1037c, 0x103d2, 0xe7d8]) {
        const pointer = word(rom, table + team*2);
        if (pointer || table === 0x1027a || table === 0xe7d8) fits(0x89, pointer, 2);
      }
      const label = decompress(rom, fits(rom[0xe6ba], word(rom, 0xe6c1 + team*2), 2));
      // Permit bounded legacy graphic variants; rendering checks exact dimensions.
      if (label.length < 64 || label.length > 256) return false;
      for (let part = 0; part < 2; part++) {
        const flag = decompress(rom, fits(rom[loRom(0x82f7a4)+6], word(rom, 0xe730 + team*4 + part*2), 2));
        if (flag.length < 96 || flag.length > 192) return false;
      }
    }
    return true;
  } catch { return false; }
}

export function openRom(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const headerSize = bytes.length % 0x8000 === 512 ? 512 : 0;
  const rom = Uint8Array.from(bytes.subarray(headerSize));
  const title = String.fromCharCode(...rom.slice(0x7fc0, 0x7fd5)).trim();
  let game, label, size, isHack = false;
  if (title === 'SUPERSTAR SOCCER 2') {
    game = 'issd'; label = 'International Superstar Soccer Deluxe (USA)'; size = 0x200000;
  } else if (title === 'Super Star Soccer') {
    game = 'iss'; label = 'International Superstar Soccer (USA)'; size = 0x100000;
  }
  const expanded=game==='issd'&&hasExpandedTeams(rom)&&rom.length===EXPANDED_ROM_SIZE&&rom[0x7fd7]===12;
  // Audio relocation also expands native ROMs to 4 MiB, including projects
  // with deleted squads. Project validation checks its directory and driver.
  const expandedAudio=game==='issd'&&hasLongAudio(rom)&&rom.length===EXPANDED_ROM_SIZE&&rom[0x7fd7]===12;
  const standard = game && (rom.length === size||expanded||expandedAudio) && rom[0x7fd9] === 1 && (rom[0x7fd5] & 0x0f) === 0;
  if (!standard && compatibleDeluxeHack(rom)) {
    game = 'issd'; label = 'ISS Deluxe · hack compatible'; isHack = true;
  } else if (!standard) {
    if (game) throw new Error('Tamaño, región o formato de ROM no compatible. Se requiere la versión USA LoROM o un hack con estructura ISSD compatible.');
    throw new Error('ROM no compatible. Abre ISS (USA), ISS Deluxe (USA) o un hack con estructura ISSD compatible.');
  }
  return { rom, game, label, title, headerSize, isHack, layout:externalDeluxeLayout(rom)?.id || 'native' };
}

// Konami's five command modes; see issd-native/ISSDNative/issd_decompress.c.
export function decompress(rom, offset) {
  const header = word(rom, offset);
  const end = offset + (header & 0x7fff);
  if (end > rom.length || end <= offset + 2) throw new Error('Bloque comprimido inválido.');
  const window = new Uint8Array(1024), output = [];
  let cursor = offset + 2, head = 0;
  const take = () => {
    if (cursor >= end) throw new Error('Bloque comprimido truncado.');
    return rom[cursor++];
  };
  const put = value => {
    if (output.length >= 65536) throw new Error('Bloque descomprimido demasiado grande.');
    output.push(value); window[head] = value; head = (head + 1) & 1023;
  };
  while (cursor < end) {
    const command = take(), mode = command >>> 5;
    const count = (command & 31) + 2;
    if (mode === 4) for (let n = 0; n < (command & 31); n++) put(take());
    else if (mode === 5) for (let n = 0; n < count; n++) { put(0); put(take()); }
    else if (mode === 6) { const value = take(); for (let n = 0; n < count; n++) put(value); }
    else if (mode === 7) { const length = command === 255 ? take() + 2 : count; for (let n = 0; n < length; n++) put(0); }
    else {
      let source = ((((command & 3) << 8) | take()) - 0x3df) & 1023;
      for (let n = 0; n < (command >>> 2) + 2; n++) { put(window[source]); source = (source + 1) & 1023; }
    }
  }
  const bytes = Uint8Array.from(output);
  if (header & 0x8000) {
    if (bytes.length % 16) throw new Error('Tiles entrelazados incompletos.');
    for (let start = 0; start < bytes.length; start += 16) {
      const pair = bytes.slice(start, start + 16);
      for (let row = 0; row < 8; row++) { bytes[start + row * 2] = pair[row]; bytes[start + row * 2 + 1] = pair[row + 8]; }
    }
  }
  return bytes;
}

export function tiles(bytes, bpp, columns) {
  const tileSize = bpp * 8;
  if (![2, 4, 8].includes(bpp) || bytes.length % tileSize || bytes.length / tileSize % columns) throw new Error('Dimensiones de tiles inválidas.');
  const rows = bytes.length / tileSize / columns;
  return Array.from({ length: rows * 8 }, (_, y) => Array.from({ length: columns * 8 }, (_, x) => {
    const tile = Math.floor(y / 8) * columns + Math.floor(x / 8);
    let color = 0;
    for (let plane = 0; plane < bpp; plane++) {
      const index = tile * tileSize + Math.floor(plane / 2) * 16 + (y % 8) * 2 + plane % 2;
      color |= ((bytes[index] >>> (7 - x % 8)) & 1) << plane;
    }
    return color;
  }));
}

export function palette(rom, offset, count) {
  return Array.from({ length: count }, (_, index) => {
    const value = word(rom, offset + index * 2);
    return '#' + [value & 31, (value >>> 5) & 31, (value >>> 10) & 31].map(c => Math.round(c * 255 / 31).toString(16).padStart(2, '0')).join('');
  });
}
