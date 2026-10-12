# Development guide

[Back to README](../README.md) · [Editor guide](editor-guide.md)

## Setup and commands

Requires Node.js, npm and a modern browser.

```bash
git clone https://github.com/EstebanFuentealba/web-snes-issd-studio.git
cd web-snes-issd-studio
npm ci
npm run dev
```

| Command | Purpose |
| --- | --- |
| `npm test` | Run the checks listed in `package.json`. |
| `npm run build` | Build the production site in `dist/`. |
| `npm run preview` | Serve the production build locally. |
| `npm run build-wasm` | Rebuild the optional native module; requires the Emscripten SDK. |

ROM reading works directly in JavaScript without WebAssembly. C++ compressor utilities and the optional WASM module remain available for native graphics processing.

## Tests with local ROMs

Place privately obtained USA ROMs in the ignored `roms/` directory:

- `International Superstar Soccer (USA).sfc`
- `International Superstar Soccer Deluxe (USA).sfc`

Tests cover binary parsing, editing, graphics, audio, formations, menus, scenarios, stadiums, groups, team management, project recovery and ROM export. Synthetic checks run where supported; local-ROM integration checks are skipped when their files are absent. A passing run with skips does not establish full ROM integration coverage.

For focused checks, run the relevant script, for example:

```bash
node tests/scenarios.cjs
node tests/main-menu.cjs
node tests/menu-text.cjs
node tests/stadiums.cjs
```

Automated checks include native CPU/DMA behavior for selected patches. Validate exported ROMs in an emulator or on hardware as well; binary tests do not establish complete game behavior.

## Source map

- `src/components/`: editor UI and emulator integration.
- `src/rom/`: game profiles, binary codecs, resource catalogs and project patches.
- `src/i18n/messages.json`: Spanish (`es`), Portuguese (`pt`) and English (`en`) translations.
- `tests/`: Node.js checks.
- `cpp/` and `public/wasm/`: native utilities and browser module.

The interface uses Vue 3 and Vite, with IndexedDB project persistence, Canvas graphics previews and Web Audio playback. Components use `$t(text)` and `$locale`; dynamic messages use `{0}`, `{1}`, etc. `npm test` checks translation coverage and matching placeholders.

## ROM and graphics constraints

The supported profiles target USA LoROM versions, including optional 512-byte copier headers. Graphics use native SNES tiles, BGR555 palettes and game-specific Konami compression. Editing and relocation must preserve pointers, storage boundaries and shared resources. Increasing an input's `maxlength` does not expand a native ROM slot: that requires relocating data and changing the game's reading and rendering routines.

Legacy ISS graphics ranges are listed below. Do not apply them indiscriminately to ISS Deluxe; use game-specific profiles and verified offsets.

| Unheadered address range | Legacy ISS resource |
| --- | --- |
| `0x48000–0x48A7F` | Flag tiles |
| `0x17680–0x17FFF` | Relocated team-name tiles |
| `0x43ED5–0x44486` | Team-name positional text |

ISSD flag relocation preserves 42 graphic slots, including hidden teams, and both original flag-loading routines. Formations store ten outfield coordinates and ten role bytes per team; the engine controls the goalkeeper.

### Scenarios

The binary layout follows the decompiled `ISSDeluxeEditor/Form1.cs` and its enums: 12 records of 15 bytes at unheadered offset `0x5FCF8`. Fixed star ratings are twelve bytes at `0xDF81` (`DATA_81DF81`, read by `CODE_8AA521`); changing them only changes the displayed rating. Position words at record offsets +11 and +13 are loaded by `CODE_8BDA6A`; stadium dimensions come from `DATA_81EC47`. Seconds use BCD encoding, team IDs use twice the native team index, and the first two bytes of each record are preserved. The selector’s two-line label is synchronized with team, score, time, and starting-play changes, including older saved projects. Labels use the native tall menu font and remain within two rows of 28 characters. Descriptions occupy twelve independent 156-byte blocks starting at `0x3F12D`, referenced by `DATA_87F113` and rendered by `CODE_8AA5A3` with the small menu font. Run `node tests/scenarios.cjs` to verify encoding, validation, history, project import, and export against a local USA ROM.

### Main-menu graphics

The expanded compressed font uses verified free bytes `$A4E17F..$A4EBFF`,
uploading 144 tiles into the menu's OBJ bank. Expanded OAM uses
`$AEE500..$AEE8FF` with 32 slots per option; `DATA_82F3AA` is updated in its
original column order to address 64-byte WRAM frames. Unused sprites are
clipped before OAM emission, and labels cannot exceed 128 visible sprites in
total. Existing projects with the original layout remain supported. Project
validation, undo/redo, local saving, recovery and ROM checksum export include
these changes. `tests/main-menu.cjs` verifies A–Z, INICIAR/JUEGO, navigation
pointers, padding, independence, restoration, import/export and pool isolation.

### Other menu text

The fixed text slots exclude script opcodes and pointers. The game-start BG3
map is stored in verified free bytes `$AAFC3F..$AAFFFF`; only its loader at
`$829201` is redirected, leaving halftime and tournament maps intact.
`tests/menu-text.cjs` verifies every field, independent edits, exact restoration,
reopening an exported ROM, project import, checksums and invalid patch rejection.

### Stadiums

Binary resources: seven-byte encoded names at `0x3CA9B`, selector yards at
`0x17AED`, and match limits at `0xEC47`. A verified 65816 hook at `$A4A046`
uses independent label data at `$86CC00` and code at `$86D000`, within the unused
`$86CB9E..$86D1FF` range. It updates the temporary first team-name OAM frame
only in stadium selection, preserving X, Y and DB; the native screen loader
reloads the atlas for subsequent menus. Team names and fonts remain untouched.
Asset and palette ranges follow `AssetPointersAndFiles.asm`; the catalog contains
only addresses and descriptions. Run `node tests/stadiums.cjs` for binary ranges,
CPU hook execution for all eight slots, team expansion compatibility, lossless
round trips for every exposed graphic, pixel/palette edits, independent partial
restoration, live scenario geometry, malformed-project rejection, and SMC/header
and checksum export.

## Research and credits

- [Implementation roadmap](../ISSD-Editor-Plan.md).
- [ISSD-SNES-ROM-Web-Editor](https://github.com/EstebanFuentealba/ISSD-SNES-ROM-Web-Editor).
- [ISS Studio by Rodrigo Mallmann Guerra](https://github.com/rodmguerra/issparser): original Java editor and inspiration.
- [Konami SNES compression tools by Vladimir Protopopov](https://github.com/ProtonNoir/SNES-decompression-tools/tree/master/Konami).
- [issd-native by sergiomanzur](https://github.com/sergiomanzur/issd-native): native editing, decompression, audio and ROM references.

Relevant `issd-native` references include `ISSDNative/issd_mod_rom.c`, `issd_decompress.c`, its DSP decoder and `deps/ISSD-disassembly/International_Superstar_Soccer_Deluxe/AsarScripts/AssetPointersAndFiles.asm`.

The dynamic-sprite loader uses `$98F014` as a global transparent 32-byte tile,
including at `$84E80E`. It is referenced by team jersey tables but also by
referees and blank sprite regions. Never erase or clone team details into this
allocation. Legacy physical-deletion projects that filled it with `FF` are
repaired on import; opening an affected exported ROM applies a zero-tile repair.
