# ⚽ Web ISSD Studio (WIP 🚧)

<p align="center">
  <img src="public/issd-logo.webp" width="600" alt="Web ISSD Studio" />
</p>

**Web ISSD Studio** is an open-source, browser-based ROM editor for **International Superstar Soccer Deluxe (ISSD)** on the Super Nintendo Entertainment System (SNES).

Customize national teams, players, uniforms, flags, graphics, sound effects, and other game assets through an intuitive graphical interface.

The project also maintains compatibility with the original **International Superstar Soccer (ISS)**.

🎮 **[Open Web ISSD Studio](https://estebanfuentealba.github.io/web-snes-issd-studio/)**

---

## ✨ Features

### 🎮 Supported Games

| Game | Region | Teams | Players per Team |
|---|---|---|---|
| International Superstar Soccer | USA | 27 | 15 |
| International Superstar Soccer Deluxe | USA | 36 | 20 |

- Automatic ROM version detection.
- Support for `.sfc` and `.smc` files.
- Support for ROMs with or without a 512-byte SMC header.
- Original ROM data is preserved until export.
- ROM processing directly in the browser.
- Other regions and expanded ROM hacks are not currently supported.

The six hidden All-Star teams in ISS Deluxe are generated dynamically by the game and are not included in the 36 editable national teams.

## 👥 Team & Player Editor

Manage national teams and customize their players.

**Team editing**
- Edit team names and graphical name labels.
- View and edit national flags.
- Customize team colors and uniforms.
- Inspect original team formations.
- Navigate between all 36 national teams.

**Player editing**
- Edit player names (8-character game-compatible format).
- Modify shirt numbers while preserving unique identifiers.
- Change player positions.
- Select from 14 hairstyles.
- Customize normal and special skin colors.
- Edit player attributes and abilities.
- Preview hairstyles using original 32×32 pixel graphics.
- Preview skin colors using the game's original palettes.
- Filter and select multiple players.
- Apply player templates.
- Undo and redo modifications.

ISSD supports ten editable player attributes.

### ⚽ Team Formations

In **Teams → Formation**, select any of the 16 in-game schemes on a horizontal pitch, drag the numbered players, or adjust their offsets with the keyboard and numeric controls. **Attack Participation** toggles the attacking role for each defender or midfielder, shown by a yellow arrow. The goalkeeper is positioned by the engine and forwards have no participation flag. Click **Apply formation** to save, or **Discard changes** to cancel the preview. You can also copy another team’s original formation. Custom coordinates use the native movement limits and preserve undo, restore, and ROM/project export without changing the roster.

The formation diagram uses the game’s horizontal DF/MF/FW layout. Each team stores ten outfield-player coordinates and ten role bytes; the goalkeeper has no coordinate entry.

## ⚽ Scenario Editor

The **SCENARIOS** menu edits all 12 ISS Deluxe USA challenges: remaining time, player and opponent teams, scores, stadium, weather, and starting play. Each scenario also has an editable description of six lines with up to 26 characters per line, using the game’s original alphabet. Apply text changes with **Apply description to ROM**. A 2D pitch lets you click or drag the ball, with arrow keys and numeric coordinates for precise adjustment. Goal kicks and corners position the ball automatically and lock coordinate controls; changing the stadium updates the fixed position. Native throw-ins remain editable. Free kicks support manual placement. Coordinates are decoded as signed 16-bit words; field dimensions follow the selected stadium and original off-field positions are preserved. Advanced controls expose their original low and high bytes. The fixed 1–5 star rating is editable independently of the AI difficulty. Each field is saved immediately and supports undo/redo, individual or full restoration, project backups, and ROM export with or without an SMC header.

The binary layout follows the decompiled `ISSDeluxeEditor/Form1.cs` and its enums: 12 records of 15 bytes at unheadered offset `0x5FCF8`. Fixed star ratings are twelve bytes at `0xDF81` (`DATA_81DF81`, read by `CODE_8AA521`); changing them only changes the displayed rating. Position words at record offsets +11 and +13 are loaded by `CODE_8BDA6A`; stadium dimensions come from `DATA_81EC47`. Seconds use BCD encoding, team IDs use twice the native team index, and the first two bytes of each record are preserved. The selector’s two-line label is synchronized with team, score, time, and starting-play changes, including older saved projects. Labels use the native tall menu font and remain within two rows of 28 characters. Descriptions occupy twelve independent 156-byte blocks starting at `0x3F12D`, referenced by `DATA_87F113` and rendered by `CODE_8AA5A3` with the small menu font. Run `node tests/scenarios.cjs` to verify encoding, validation, history, project import, and export against a local USA ROM.

## 🎨 Pixel Art Maker

The integrated **Pixel Art Maker** allows you to edit original SNES graphics directly in your browser.

Supported graphics include:

- National flags.
- Team name labels.
- Main menu logo.
- Player and goalkeeper sprites.
- Uniform details (shirts and shorts).
- Hairstyles.
- Player numbers.
- Soccer ball graphics.

### 🖼️ Import Images as Pixel Art

Import your own images and convert them into SNES-compatible pixel art.

- Supports PNG, JPG, WebP, GIF and BMP.
- Automatic image cropping and resizing.
- Color quantization.
- Palette extraction from uploaded images.
- Option to preserve the original palette.
- Preview before applying modifications.
- Horizontal and vertical flipping.
- Restore original graphics.

**Flag editor**

The flag editor converts imported images to **24×16 pixels**, using up to four colors. Each flag can be edited independently.

**Team labels**

Team name labels use a compact **32×8 pixel** format. The original red label style is preserved.

**Player graphics**

Edit player and goalkeeper graphics using the original ROM tiles and palettes. The dedicated uniform-detail editor currently modifies the front-facing chest tile; additional poses are planned.

**Main menu logo**

The logo editor reconstructs graphics using original tiles, tilemaps and palettes. Some pixels are shared between graphic elements, so editing follows the original palette and tile constraints.

Compressed graphics must fit within the available ROM storage space.

In **Gráficos**, the mode titles **SHORT LEAGUE**, **SHORT TOURNAMENT**, **INTERNATIONAL**, **WORLD SERIES · 1ST SEASON**, and **ENTER PASSWORD** can be drawn or imported as pixel art. Mode previews combine the native letter masks, textured fill and reflected palettes. The password preview shows the lettering without its animated background. These resources retain their native shared tiles: edits to a title letter or texture also affect its other appearances, and password letters are shared with other menus. Undo/redo, project saving, ROM export and restoring the shared resource are supported.

**Startup screens**

In **Gráficos**, select **Inicio · Logo de Konami** or **Inicio · Pantalla posterior a Konami** to draw or import a replacement image for either screen independently. Both use a 256 × 224 canvas and their original SNES palettes. Imported images are adjusted to one palette per 8 × 8 tile. Scene-specific graphics and maps are relocated into verified free ROM space; the original animation helpers and other scenes retain their native data. Undo/redo, project recovery, reopening an exported ROM and restoring each screen independently are supported. Detailed images may exceed the available unique tiles or compressed storage; the editor rejects them without applying a partial change. The original intro timing and effects remain in place; this edits the two images, rather than introducing a new animation sequence.

**Title screen notices**

In **Gráficos**, select **Portada · 1995 KONAMI ALL RIGHTS RESERVED** or **Portada · LICENSED BY NINTENDO** to edit the notice with a text input and live preview, or draw or import a replacement image. Text inputs support A–Z, digits, spaces, periods, hyphens and © (up to 40 and 26 characters respectively); applied text is retained when reopening a project or exported ROM. The editable strips measure 240 × 8 and 160 × 8 pixels and retain the title's original palette. Each notice has independent tiles, so repeated letters can be edited freely without changing the other notice or PRESS START. Applying changes reserves verified free ROM space; undo, project recovery and restoring either notice are supported.

## 👕 Uniform & Color Editor

Customize team appearance using original SNES BGR555 palettes.

- Home and away uniforms.
- Goalkeeper colors.
- Player skin tones.
- Normal and special player palettes.
- Hair colors.
- Flag palettes.
- Shared color resources.

The editor identifies shared palettes and indicates when a modification may affect multiple teams or players.

## 🔊 Audio Editor

ISSD Studio can inspect, preview, export and partially replace the game's original audio samples.

**Audio inspection**
- Load all 76 original BRR samples.
- Preview audio directly in the browser.
- Display waveforms.
- Inspect DSP pitch information.
- Export decoded samples as WAV.
- Adjust playback preview frequency (8, 16 or 32 kHz).

**Audio replacement**
- Import WAV files.
- Support 8-bit and 16-bit PCM.
- Support mono and stereo input.
- Convert WAV audio into SNES-compatible BRR.
- Automatically normalize each selected clip to a common active-signal RMS level before BRR encoding, with soft peak limiting. Silence stays silent and unused storage stays padded with zeros.
- Normalize all previously applied audio replacements together with **Normalizar audios modificados**; the operation supports undo and preserves playback markers. Game event volumes and DSP envelopes still affect the final audible level.
- Preview converted samples before applying.
- Replace 69 of the 76 original samples within their fixed storage allocations.

**Current limitations**

- Certain looped or fragmented samples cannot be replaced safely.
- The exact playback frequency of every sound event has not been verified.
- The 12 kHz inspection reference does not represent a verified playback frequency for every sample.
- Preview playback does not fully emulate the SNES DSP, including envelopes, echo and pitch behavior.
- Sequenced background music editing requires additional SPC700/DSP support.

## 💾 Project Management & ROM Export

Work on your ROM without permanently modifying the original file.

- Automatic project saving with IndexedDB.
- Project identification using SHA-256.
- Original ROM kept immutable.
- Resource-level modification tracking.
- Export and import projects as JSON.
- Restore original resources.
- Export modified ROM files.
- Binary validation before export.
- SNES checksum recalculation.
- Preserve original ROM size and SMC header.

Exporting a project without modifications produces a ROM identical to the original input.

**Important:** Modified ROM exports and graphic relocation still require validation in a SNES emulator or on original hardware.

---

## 🚀 Getting Started

### Online Editor

1. Open [Web ISSD Studio](https://estebanfuentealba.github.io/web-snes-issd-studio/).
2. Select a compatible ISS or ISS Deluxe USA ROM from your own collection.
3. Wait for automatic ROM detection and asset loading.
4. Select a team, player, graphic or audio resource.
5. Edit your game.
6. Export the modified ROM.

ROM files are not included or distributed with this project.

### Test the edited ROM

Open **Emulador** in the editor menu to load a validated export of the current
project, including its applied changes and updated checksum. Click **Iniciar
juego** inside the screen to start SNES emulation. The emulator uses
[EmulatorJS](https://emulatorjs.org/docs/systems/snes/) and downloads its runtime
from the EmulatorJS CDN, so internet access is required.

Use **Recargar ROM modificada** after making further edits or undoing changes;
this restarts the game with the latest ROM. Pending graphic/audio previews must
be applied to become part of the ROM. **Detener**, leaving the emulator menu,
or opening another ROM stops the runtime. Pause, fullscreen, keyboard and
gamepad settings are available in the emulator toolbar. SMC copier headers are
removed from the emulator copy; exported downloads still preserve them.

**Panel de prueba** sends SNES button presses to player 1 or 2 with a selectable
press duration. **Guía para ir al selector** describes the native menu steps;
**Cancelar secuencia** releases a pending button press.
Name and save up to eight screens, then use **Ir a** to restore their exact game
state. Screen bookmarks stay in memory for the loaded ROM and are cleared when
reloading, stopping, or leaving the emulator.

### Local Development

**Requirements**
- Node.js and npm.
- A modern web browser.
- Emscripten SDK for rebuilding the optional WebAssembly module.

Clone the repository and install dependencies:

```bash
git clone https://github.com/EstebanFuentealba/web-snes-issd-studio.git
cd web-snes-issd-studio
npm ci
```

Start the development server:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Build for production:

```bash
npm run build
```

Build the WebAssembly module when required:

```bash
npm run build-wasm
```

The ROM reader works directly in the browser without requiring WebAssembly. The C++ compressor and supporting code are retained for graphics processing and future editing functionality.

### Testing with Original ROMs

Place your privately obtained compatible ROM files in the `roms/` directory to enable additional validation.

Tests cover ROM parsing, team data, player information, graphics, audio samples and editing operations.

Synthetic test vectors are used when original ROM files are unavailable.

---

## 📋 Development Status

| Feature | Status |
|---|---|
| ISS USA ROM detection and reading | ✅ Implemented |
| ISS Deluxe USA ROM detection and reading | ✅ Implemented |
| Team and player data reading | ✅ Implemented |
| Player names, numbers and positions | ✅ Implemented |
| Player attributes, hairstyles and skin colors | ✅ Implemented |
| Team and uniform palette editing | ✅ Implemented |
| Flag Pixel Art Maker | ✅ Implemented |
| Team name graphics editor | ✅ Implemented |
| Player and goalkeeper graphics editor | ✅ Partial |
| Main menu logo editor | ✅ Partial |
| Image import and pixel art conversion | ✅ Implemented |
| Original team formation viewer | ✅ Implemented |
| Custom formation coordinates and attack participation | ✅ Implemented |
| Audio BRR reading and WAV export | ✅ Implemented |
| WAV import and BRR replacement | ✅ Partial |
| Sequenced music editing | ⏳ Planned |
| IndexedDB autosave | ✅ Implemented |
| JSON project import/export | ✅ Implemented |
| Modified ROM export | ✅ Implemented |
| Add, remove or reorder teams | ⏳ Research |
| Main menu player photographs | ✅ Five assembled 8bpp photos: drawing, image import and ROM export |
| Team photographs | ⏳ Planned |
| Emulator and hardware validation | ⏳ Pending |

### Known Limitations

- The number of teams is currently fixed at 36 for ISS Deluxe USA.
- Adding, deleting or reordering teams requires additional reverse engineering of executable code and references.
- Team photographs are not yet editable. The five title photos share one compressed block and its original palette; edits must fit in the available bytes.
- Some compressed graphics have strict size limitations.
- Shared graphic resources may affect multiple elements.
- Goalkeeper formation coordinates are controlled by the engine.
- Complete SNES DSP audio emulation is not implemented.
- Modified ROMs have not yet completed emulator validation.

See [ISSD-Editor-Plan.md](ISSD-Editor-Plan.md) for the implementation roadmap and remaining tasks.

---

## 🔧 Technical Details

### ROM Formats

The editor currently targets verified USA LoROM versions of International Superstar Soccer and International Superstar Soccer Deluxe.

Supported file extensions:

- `.sfc`
- `.smc`

ROM files with a 512-byte copier header are supported.

### Graphics and Compression

The editor uses original SNES tile graphics and palette data. Certain graphics are compressed using Konami's proprietary game-specific compression format.

Graphics editing and relocation must preserve the ROM's internal pointers and resource boundaries.

### ROM Addresses

The following address ranges are associated with the original ISS graphics editor implementation.

| Address range | Description |
|---|---|
| `0x48000–0x48A7F` | Flag graphic tiles |
| `0x17680–0x17FFF` | Relocated team name graphic tiles |
| `0x43ED5–0x44486` | Team name positional text |

These legacy address ranges must not be assumed valid for every ISS Deluxe resource. The editor uses game-specific profiles and verified offsets.

The flag relocation logic preserves all 42 graphics slots, including hidden teams, and both original flag-loading routines. Emulator validation is still pending.

### Research & Documentation

- [ISSD-SNES-ROM-Web-Editor](https://github.com/EstebanFuentealba/ISSD-SNES-ROM-Web-Editor)
- [issd-native](https://github.com/sergiomanzur/issd-native)
- [ISSD-PLAN.md](ISSD-PLAN.md)
- [ISSD-Editor-Plan.md](ISSD-Editor-Plan.md)

Relevant reverse-engineering references from `issd-native` include:

- `ISSDNative/issd_mod_rom.c`
- `issd_decompress.c`
- DSP audio decoder
- `deps/ISSD-disassembly/International_Superstar_Soccer_Deluxe/AsarScripts/AssetPointersAndFiles.asm`

---

## 🤖 Technologies

- **Vue 3** — Web user interface.
- **Vite** — Development and production builds.
- **JavaScript** — ROM parsing, asset editing and browser integration.
- **C++** — Native graphics processing and compression utilities.
- **WebAssembly (WASM)** — Browser integration for native components.
- **IndexedDB** — Local project persistence.
- **HTML Canvas** — Pixel art editing and graphics previews.
- **Web Audio API** — Audio inspection and playback.

## ⚖️ Legal Notice

Web ISSD Studio is an independent, fan-made project and is not affiliated with or endorsed by Konami or Nintendo.

International Superstar Soccer and International Superstar Soccer Deluxe are trademarks or intellectual property of their respective owners.

This repository does not include copyrighted game ROMs, original game audio files or distributed commercial game assets.

Users are responsible for obtaining and using ROM files in accordance with applicable laws.

## 👍 Acknowledgements

Special thanks to the developers and researchers whose work helped make this project possible.

**[Rodrigo Mallmann Guerra](https://github.com/rodmguerra)**

Creator of [ISS Studio](https://github.com/rodmguerra/issparser), the original Java-based ISS editor that inspired this web project.

**[Vladimir Protopopov](https://github.com/ProtonNoir)**

Creator of the [Konami SNES Compressor](https://github.com/ProtonNoir/SNES-decompression-tools/blob/master/Konami/konami_c.cpp) and [Konami SNES Decompressor](https://github.com/ProtonNoir/SNES-decompression-tools/blob/master/Konami/konami_d.cpp).

**[sergiomanzur](https://github.com/sergiomanzur/issd-native)**

For the ISS Deluxe native editing tools, decompression research, audio decoding and ROM structure references.

---

**⚽ Web ISSD Studio — Bring your own version of International Superstar Soccer Deluxe to life!**

### Idiomas de la interfaz

El selector de idioma permite usar toda la interfaz en español, portugués o inglés. Se detecta inicialmente el idioma del navegador (español como respaldo) y la elección se conserva en `localStorage`. Las traducciones incluyen navegación, controles, avisos, validaciones, accesibilidad y etiquetas de equipos y atributos; los nombres editados y los datos binarios de la ROM se conservan.

Los textos se centralizan en `src/i18n/messages.json`, con variantes `es`, `pt` y `en`. Los componentes usan `$t(texto)` y `$locale`; los mensajes dinámicos usan marcadores `{0}`, `{1}`, etc. `npm test` verifica que los tres idiomas estén completos y mantengan sus marcadores. El emulador recibe el idioma seleccionado; cambiarlo mientras está abierto reinicia la emulación con el nuevo idioma.

### Títulos de grupos y gráficos de portada

En Gráficos están disponibles los siete títulos originales de selección. Cada uno tiene un input de texto con previsualización al escribir y gráficos independientes, incluidos EUROPE 1–4. Configuración permite conservar, mostrar siempre u ocultar siempre la página ALL STARS en la ROM exportada.

El jugador completo incluye las dos filas de tiles y las posiciones de sprites grandes. El fondo rojo de portada se puede editar por separado; borrar el logo completo también limpia las capas que tenía debajo. Los dos textos inferiores de portada tienen recursos independientes.

El menú **Grupos** permite renombrar los siete grupos originales, agregar nuevos (hasta 16), quitar grupos y elegir sus equipos, incluidos grupos de cuatro u ocho. Los cambios se guardan en el proyecto y en la ROM exportada, con deshacer/rehacer y restauración. Los grupos vacíos no aparecen en el juego; debe quedar al menos un equipo. Un equipo puede pertenecer a varios grupos.

En **Configuración → Columnas de banderas** se puede elegir **3 columnas · 2 filas** (hasta seis equipos por página) o **4 columnas · 1 fila** (hasta cuatro). La distribución modifica la pantalla nativa del juego, con banderas, nombres, cursor y flechas alineados. Los grupos mayores se dividen en páginas con el mismo título; uno de ocho equipos ocupa dos páginas en ambas opciones. La opción se guarda con el proyecto y admite deshacer/rehacer. Se adaptan los conteos, controles, búsqueda, paletas, banderas, rótulos y referencias de jugadores. El atlas de títulos conserva su capacidad de 1850 bytes comprimidos; un dibujo que la exceda se rechaza sin modificar el proyecto. Cuando se usan grupos personalizados, estos controlan la visibilidad de ALL STARS.

En **Equipos → Nuevo equipo → Agregar equipo** se pueden crear hasta **48 equipos** (los 42 originales y seis adicionales). Cada nuevo equipo copia los datos actuales de Italia en planteles, nombres de jugadores, uniformes, bandera y formación independientes, y aparece en el grupo **EXTRA**. El nombre grande admite hasta diez caracteres A–Z, puntos y espacios; el nombre pequeño también debe caber en sus 32 píxeles. La ampliación usa espacio libre verificado de la ROM USA de 2 MiB, conserva el tamaño y el encabezado SMC y admite guardado, importación, deshacer/rehacer y edición de los equipos nuevos. Cada grupo admite hasta 42 equipos; para mostrar los 48 se pueden distribuir en varios grupos. Los formatos de los torneos conservan sus reglas originales. Las rutinas modificadas se verifican en pruebas de CPU de 16 bits y DMA, además de importación/exportación y checksum.

### Main menu editor

Open **Menus → Menú principal** to edit the eight option labels with a live assembled
preview. Two text lines support **A–Z**, spaces and hyphens, up to 112 pixels per
line. The original large glyphs are preserved; missing letters are added in
the same palette. For example, **INICIAR / JUEGO** fits the first option.
Changing a label retains its game action. Each option can be restored
independently. Shared letters, panel and blue background also support drawing
and image import. The panel is displayed as its complete 128 × 48 button and
the blue background as its assembled 256 × 224 screen, with tile reuse and
flips retained when saving. The global panel border is protected context.

The expanded compressed font uses verified free bytes `$A4E17F..$A4EBFF`,
uploading 144 tiles into the menu's OBJ bank. Expanded OAM uses
`$AEE500..$AEE8FF` with 32 slots per option; `DATA_82F3AA` is updated in its
original column order to address 64-byte WRAM frames. Unused sprites are
clipped before OAM emission, and labels cannot exceed 128 visible sprites in
total. Existing projects with the original layout remain supported. Project
validation, undo/redo, local saving, recovery and ROM checksum export include
these changes. `tests/main-menu.cjs` verifies A–Z, INICIAR/JUEGO, navigation
pointers, padding, independence, restoration, import/export and pool isolation.

The other five tabs (**Menú secundario**, **Menú settings**, **Menú training**,
**Menú handicap**, **Menú juego**) also edit text in the ROM, with a live text
preview, per-label apply/discard/restore and shared project history. Each field
shows its native line and character limits; supported characters depend on its
font. Training descriptions and the handicap instructions support multiple
lines. The shared training `MODE` label and handicap strength labels retain
their shared uses. Compact handicap labels use the small character font when
edited, and game-start replacements use up to 15 characters in the native tall
font. Restoring recovers the original compact graphics.

The fixed text slots exclude script opcodes and pointers. The game-start BG3
map is stored in verified free bytes `$AAFC3F..$AAFFFF`; only its loader at
`$829201` is redirected, leaving halftime and tournament maps intact.
`tests/menu-text.cjs` verifies every field, independent edits, exact restoration,
reopening an exported ROM, project import, checksums and invalid patch rejection.

En **Equipos → Eliminar equipo de los grupos** se quita el equipo seleccionado de todos los grupos del selector. Debe quedar al menos un equipo. La operación conserva el plantel, gráficos y referencias de Scenarios, mantiene los IDs de la ROM y no libera uno de los seis espacios adicionales. Puede deshacerse/rehacerse o volver a incluirse el equipo desde **Grupos**; el cambio persiste en el proyecto y en la ROM exportada.

Los nombres de jugadores ocupan **8 bytes** (hasta ocho caracteres admitidos por la codificación del juego). Los nombres grandes de equipo tienen una capacidad propia de cada slot (los nuevos admiten diez caracteres), además del límite de sprites y ancho; los nombres pequeños deben caber en **32 píxeles**. Aumentar un `maxlength` del editor no amplía la ROM: requiere reubicar datos y modificar las rutinas de lectura y dibujo del juego.

## Stadiums

The **Estadios / Stadiums** menu edits the eight USA cartridge slots: Japan,
U.S.A., Spain, Italy, England, Germany, Brazil and Nigeria. Names accept up to
seven uppercase letters, spaces and periods. The selection plate and match
information use the new name independently of team names. The selector displays
length and width in yards (100–140 × 64–96). Advanced controls edit the match
coordinate limits (length 1792–2176, width 576–704, in steps of 64); Scenarios
uses these live dimensions for its ball controls and automatic restarts.
Changing coordinate limits does not rebuild the stadium's graphic tilemaps:
review the alignment of markings and walls in the emulator.

The design editor exposes 38 native graphic blocks: stadium banners, walls and
details, plus shared grass, audience, shadows and weather previews. Field icons are
edited per stadium inside their native shared container; partial restoration
preserves the other seven icons.
Resource cards show assembled native designs rather than tile atlases. The editor
reconstructs the match Map32 layers and selector tilemaps with their native palettes
and flips. Choose another view of a resource, draw directly on its design, or import
an image. Darkened context is protected and repeated source pixels update together;
subsequent strokes preserve earlier edits. Shared resources absent from the current
match use a reference stadium. The advanced tile view retains access to all source
pixels, including resources without a match appearance. Graphics must fit their
original compressed capacity. Palette controls cover clear, rain, snow, night,
stands, cameras, penalty kicks and the selector; the assembled match view uses the
native clear-weather palettes. Shared designs and selector palettes are marked in the
UI. Restore a single design, palette or stadium, or restore all stadium resources.
All applied changes participate in autosave, project backups, undo/redo and ROM
export; unapplied drafts are checked before navigation.

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

En **Equipos → Eliminar físicamente de la ROM** también se pueden borrar los equipos originales. El parche conserva los IDs originales, marca el espacio libre y borra nombres/atributos y los recursos gráficos, formación y colores que no usa ningún equipo restante. Los nombres compartidos de ALL STARS se convierten en copias independientes antes del borrado; sus jugadores conservan sus nombres. Las referencias de Scenarios se reasignan y los estadios usan rótulos independientes. Las llamadas nativas a IDs eliminados se redirigen al primer equipo existente; los torneos conservan su formato y pueden usar ese reemplazo en sus plazas fijas.

Los equipos adicionales se compactan al eliminar uno intermedio y se borran todos los datos de los espacios sobrantes. **Agregar equipo** reutiliza primero un espacio original libre que admita tanto los caracteres como los sprites del nombre solicitado; si ninguno es compatible, usa un espacio adicional disponible, hasta 48 equipos existentes. Los espacios originales conservan su capacidad de nombre y sus gráficos compartidos. Si Italia fue eliminada, el equipo nuevo copia el primer equipo existente. La ROM conserva sus 2 MiB y el encabezado SMC; liberar un espacio no reduce el tamaño del archivo. Debe quedar al menos un equipo. El proyecto guarda la ROM original y el historial para deshacer/rehacer; la ROM exportada contiene el borrado físico.

En **Crear ROM sin equipos** el editor crea una plantilla con cero equipos activos y cero grupos visibles. Puedes deshacer la operación, guardar el proyecto o exportar y volver a abrir la ROM vacía. Se conserva una plantilla interna oculta para crear el primer plantel sin volver a cargar la ROM original; los siguientes equipos se agregan normalmente. Los equipos creados desde esta plantilla comienzan con bandera blanca. En Gráficos, **Original** muestra la bandera blanca y el rótulo con el nombre asignado al crear el equipo; las restauraciones usan esa referencia, que también se guarda en el proyecto y acompaña deshacer/rehacer. Al reabrir una ROM exportada, sus gráficos guardados pasan a ser la referencia original. Crea al menos un equipo antes de usar el emulador.
