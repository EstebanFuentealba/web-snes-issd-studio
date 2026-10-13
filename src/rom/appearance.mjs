import {teamPointer,teamPaletteOffset} from './team-count.mjs';
import { loRom, word, tiles, palette } from './binary.mjs';

// Team home palettes and alternate skin/hair records used by CODE_98F869.
// Low nibble 1..13 selects DATA_81ED6D; zero keeps the standard sprite head.
export function deluxeAppearance(rom, teamIndex, player) {
  const kitTable = player.position === 1 ? 0x10326 : 0x1027a;
  const kit = teamPaletteOffset(rom,teamPointer(rom,kitTable,teamIndex));
  const colors = new Array(16).fill('transparent');
  colors.splice(player.position === 1 ? 1 : 0, player.position === 1 ? 11 : 16, ...palette(rom, kit + 2, player.position === 1 ? 11 : 16));
  if (player.skin !== 0) {
    const skinPointer = teamPointer(rom,0x1037c,teamIndex);
    const hairPointer = teamPointer(rom,0x103d2,teamIndex);
    if (skinPointer) colors.splice(2, 5, ...palette(rom, teamPaletteOffset(rom,skinPointer) + 2, 5));
    if (hairPointer) colors[1] = palette(rom, teamPaletteOffset(rom,hairPointer) + 2, 1)[0];
  }
  const skinColor = colors[4];
  colors[0] = 'transparent';
  const bodyOffset = loRom(0xa9a7c4) + 2;
  const body = tiles(rom.slice(bodyOffset, bodyOffset + 64), 4, 2);
  const baseHead = body.map(row => row.slice(4, 12).map(pixel => pixel >= 7 ? 0 : pixel));
  let headOffset;
  if (player.hair === 0) {
    // Down/idle head spans the two top tiles of the standard body sprite.
    // Skip its two-byte transfer length and crop out the shirt (indices 7+).
    return { skinColor, head: baseHead, headColors: colors };
  } else if (player.hair >= 1 && player.hair <= 13) {
    const pointerOffset = 0xed6d + (player.hair - 1) * 4;
    const address = word(rom, pointerOffset) | (rom[pointerOffset + 2] << 16);
    // Fourth column of the 24-frame hairstyle atlas, selected for visibility.
    headOffset = loRom(address) + 3 * 32;
  } else return { skinColor, head: null, headColors: colors };
  return { skinColor, head: tiles(rom.slice(headOffset, headOffset + 32), 4, 1), headColors: colors };
}
