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

### Expanded TEAM v3

The 56-team format uses a 4 MiB LoROM and metadata version 3 at `$B0FE00`.
Legacy v1/v2 drafts remain readable and migrate atomically only when team 49
or a 9–10-character name is requested. Banks C0/C1/C2/C4/C5/C6/C7/C8 own the
relocated tables, palettes, attributes, names, flags, labels, photo tables and
code/OAM. Bank C1 uses low-half pointers through LoROM mirrors; a palette
loader dispatch retains native/global bank-89 palettes. The 57th table record
belongs to Challenge, not a playable team. Removed IDs resolve to a live squad.

Name copies are 200 bytes: home `$7ED478..$7ED53F`, away
`$7ED540..$7ED607`, before match data at `$7ED60C`. All roster/HUD indexing
uses a ten-byte stride and emits ten glyphs. Added flags 48–55 occupy
`$7F6000..$7F65FF`, while labels 48–55 occupy `$7F4600..$7F47FF`.
The flags avoid the selector’s temporary label output at `$7F4CC0..$7F4E1F`.
The verified tables, metadata and OAM layout currently support 56 squads. Expanded team-name coordinates finish at `$5468`; small UI frames move
to `$5470`, before the following object at `$557A`, with native `$2000` plane
separation. Tests execute injected 65816 routines, including byte stacks,
DB-sensitive palette DMA and low-half mirrors; integrate with the real SNES
emulator as well. Run `tests/expanded-teams.cjs`, `tests/expanded-teams-cpu.cjs`
and `tests/wc26-stadiums.cjs` for the new formats and WC26 stadium resources.

The native 2 MiB decompressor masks bank bit `$40` and treats it as a
script-control flag. The expanded engine hooks `$80B76F` in 8-bit accumulator
mode: only the owned C5/C6/C8 compressed pools retain their full bank; native
pointers retain their original flags. The selector's generated flag-palette
script uses bank C1, as does the general palette dispatch. Opening exact early
v3 engines repairs these hooks and the relocated flag-cache table/script
without changing player, team-name, flag, palette or group edits.

For full CPU/PPU verification, build the official Snes9x libretro core and run
`SNES9X_CORE=/absolute/path/to/snes9x_libretro.dylib npm run test:expanded-runtime`
(use `.so` or `.dll` on other platforms). The Python runner uses only the
standard library. It compares native menu pixels/OAM/background and selector
palettes, selects squad 55, checks every cached flag/label and name sprite,
and starts a match with all twenty home names containing ten characters.

The small-label resolver is shared by the selector and handicap loader at
`$85A8E3`; team IDs 48–55 must use their relocated cache in both screens.
The HUD name-stride helper returns the computed address in A **and X**,
matching the native `TAX` instruction it replaces. Runtime tests inspect
VRAM name tiles and handicap label uploads, rather than only the name pool.
Compact names retain native white/gray strokes and add black outline pixels.
Only exact rasters from the prior generator are upgraded automatically;
native names and custom pixel artwork remain intact.

### Reconocimiento de hacks con estructura nativa

La detección de hacks no depende del nombre del archivo ni del título SNES.
Acepta ROMs LoROM de 2 a 4 MiB, alineadas a bancos de 32 KiB, con o sin
cabecera de copiador de 512 bytes. Exige dos de tres rutinas independientes del
motor ISSD y valida los punteros de nombres, formaciones, paletas y bloques
comprimidos de los 42 equipos. Los perfiles de expansión del Studio y WC26
conservan sus validaciones específicas.

Los bloques gráficos de hacks antiguos pueden tener tamaños diferentes.
Reconocer la ROM no habilita automáticamente la edición de esos recursos:
si un gráfico no se puede representar con las dimensiones conocidas, se omite
del editor gráfico y se informa el motivo. Sus bytes se conservan al editar
jugadores. Los dorsales repetidos de la ROM original tampoco impiden editarla;
una transacción no puede reducir la cantidad de dorsales distintos de un equipo.

`tests/local-hack-roms.cjs` localiza fixtures del usuario en Downloads sin
incluirlas en Git. `tests/hack-roms.cjs` comprueba apertura, lectura de los 42
equipos, cambios acotados, cabecera, recuperación y undo/redo.
`npm run test:expanded-runtime` también ejecuta `tests/hack-roms-runtime.cjs`
para los hacks disponibles: arranca un partido original y otro exportado,
comprueba veinte nombres editados en RAM y los tiles de TEST en VRAM. Una ROM
que reubique tablas o modifique las rutinas de identificación puede requerir
un perfil adicional; no se acepta solamente por su extensión o título.

### Audio: stretch conservando el tono

El editor permite contraer o alargar el recorte entre 10 % y 200 % arrastrando
el extremo rojo de la forma de onda de salida, superpuesta al bloque azul en
la misma pista y escala temporal. Los extremos azules siguen seleccionando
el fragmento original. Una sola onda muestra el audio sobre una escala de tiempo de salida: tanto
la onda como los extremos azules y rojos usan la misma transformación temporal.
No se deja un hueco dentro del recorte por mezclar segundos originales y
comprimidos. El resumen indica segundos originales incluidos → segundos en
la ROM; el espacio disponible fuera del audio se muestra con un tramado. La línea discontinua marca
la capacidad BRR de la muestra al pitch de inspección seleccionado. Al reducir el factor rojo, el extremo final azul se amplía automáticamente
hasta el máximo fragmento que cabe, conservando su inicio. El control
«Stretch para encajar en ROM» comprime todo el audio restante desde el inicio
del recorte; recorta solamente si el mínimo de 10 % aún excede la capacidad.

`stretchAudio` usa WSOLA (ventanas con solapamiento y alineación por correlación)
sobre PCM mono antes de normalizar, remuestrear y codificar a BRR. Conserva la
frecuencia de muestreo y no modifica el pitch DSP de los eventos del juego. La
previsualización reproduce los bytes BRR resultantes, incluido el relleno de
silencio; los límites y marcas de las muestras segmentadas se conservan.

`tests/audio-stretch.cjs` comprueba duración, tono y controles de capacidad.
`tests/audio-stretch-runtime.cjs` verifica el PCM producido por Snes9x con
reemplazos de portada; `ISSD_CAPTURE_AUDIO=1` habilita el volcado estéreo PCM16
`.pcm` del ejecutor headless.
