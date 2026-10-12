# Editor guide

[Back to README](../README.md) · [Development guide](development.md)

## Supported ROMs and projects

The editor accepts USA versions of ISS and ISS Deluxe in `.sfc` or `.smc` format, with or without a 512-byte SMC copier header. ISS has 27 teams with 15 players each; ISS Deluxe has 36 national teams and six All-Star teams, with 20 players per team. Advanced editing features described below target ISS Deluxe USA.

Load a ROM from your own collection, choose a resource, edit it and apply pending previews before exporting. The original file stays unchanged. Projects autosave in IndexedDB and are identified by SHA-256; export a JSON backup to keep a portable copy. “Download project without ROM” saves patches and created teams without embedding the original cartridge. Reopen it by loading the exact original ROM and importing the JSON; its SHA-256 must match. “Download project with ROM” includes the original file. Local autosaves retain the original ROM. Applied changes support undo/redo, restoration and project import/export.

ROM export validates binary changes and recalculates the SNES checksum while preserving file size and the copier header. Exporting an unchanged project produces the original ROM. Test modified exports in an emulator or on hardware, especially after graphic relocation or native game patches.

## Teams, players and formations

Edit team names, graphical labels, flags, uniforms and player names, shirt numbers, positions, attributes, hairstyles and skin colors. Player names occupy eight game-encoded bytes. Large team names have a capacity specific to each slot; small labels must fit within 32 pixels.

Click a player row or its ▶ button to open the inspector. It shows eight original player views, clickable statistics, keyboard controls and manual rotation. Only one inspector opens at a time. The roster pitch shows the saved formation and eleven starters, with substitutes below; selecting a shirt number opens that player's row. On smaller screens, **Cancha** opens a floating pitch.

In **Teams → Formation**, choose one of 16 schemes, drag outfield players or adjust coordinates with keyboard and numeric controls. **Attack Participation** sets the attacking role of defenders and midfielders. Yellow arrows mark active roles; forwards have no participation flag and the engine positions the goalkeeper. Use **Apply formation** or **Discard changes**, or copy another team's original formation.

### Groups and team management

**Grupos** lets you rename the seven original groups, create up to 16 groups and assign teams. A team may appear in multiple groups. Empty groups are hidden and at least one team must remain, except when explicitly creating an empty ROM template.

**Configuración → Columnas de banderas** offers six teams per page (3 columns × 2 rows) or four (4 columns × 1 row). Larger groups span multiple pages using the same title. Each group accepts up to 42 teams. Custom groups control All-Star visibility; otherwise, configuration can preserve, show or hide the original All-Star page.

**Equipos → Nuevo equipo → Agregar equipo** supports up to 48 existing teams. It reuses compatible deleted original slots before allocating one of six extra slots. New extra slots support large names of up to ten characters (A–Z, periods and spaces); original slots retain their own name and graphic limits. New teams copy Italy's current roster and resources, or the first existing team if Italy was deleted, and appear in **EXTRA**.

- **Eliminar equipo de los grupos** hides a team from all selection groups while retaining its data and ID. Add it back through **Grupos**.
- **Eliminar físicamente de la ROM** clears team data and resources unused by remaining teams. Original IDs remain stable, extra slots are compacted and scenario references are reassigned. Native references to deleted IDs use the first existing team; tournaments keep their original formats.
- **Crear ROM sin equipos** creates a template with no active teams or visible groups. A hidden roster template allows creating the first team, whose flag starts white. Save, export, reopen or undo the template normally; create at least one team before starting the emulator.

Physical deletion keeps the ROM at 2 MiB. Shared original graphics retain their constraints. In empty-template projects, original flag and label previews use the new team's creation reference; reopening an exported ROM uses its saved graphics as the original reference.

## Graphics and palettes

The Pixel Art Maker edits native tiles and palettes for flags, labels, player and goalkeeper sprites, hairstyles, shirt numbers, ball graphics, logos and other screens. Import PNG, JPG, WebP, GIF or BMP images with cropping, resizing, color quantization and preview. You can preserve the original palette, flip artwork or restore resources.

- Flags use 24 × 16 pixels and up to four colors; small team labels use 32 × 8 pixels.
- Uniform-detail editing currently covers the front-facing chest tile; additional poses remain planned.
- Uniform, goalkeeper, skin, hair and flag colors use SNES BGR555 palettes. Shared resources are marked because edits can affect multiple appearances.
- Compressed resources must fit their storage limits. The group-title atlas has a compressed capacity of 1,850 bytes.

### Startup, title and mode screens

In **Gráficos**, edit the Konami logo and the following startup screen independently on 256 × 224 canvases. Imports use one palette per 8 × 8 tile. The editor relocates scene graphics and maps into verified free space; excessive tile counts or compressed sizes are rejected. Original timing and animation effects remain.

The title notices **1995 KONAMI ALL RIGHTS RESERVED** and **LICENSED BY NINTENDO** support text, drawing and image import. Text accepts A–Z, digits, spaces, periods, hyphens and ©, with limits of 40 and 26 characters. Their strips are 240 × 8 and 160 × 8 pixels and use independent tiles.

The five title player photographs share a compressed block and palette; replacements must fit the available bytes. Team photographs remain planned. The complete title player, red background and seven selection-group titles are also editable; group titles have independent graphics, including EUROPE 1–4.

Mode titles (**SHORT LEAGUE**, **SHORT TOURNAMENT**, **INTERNATIONAL**, **WORLD SERIES · 1ST SEASON**, **ENTER PASSWORD**) retain native shared letters and textures. Changes can affect other appearances. Mode previews include reflected palettes; the password preview omits its animated background.

## Menus

**Menus → Menú principal** edits eight option labels with an assembled live preview. Each option supports two lines of A–Z, spaces and hyphens, up to 112 pixels per line; changing its label retains its game action. Restore labels independently. Shared letters, the 128 × 48 button panel and the 256 × 224 blue background also support drawing and image import. The global panel border is protected.

The five other tabs (**Menú secundario**, **Menú settings**, **Menú training**, **Menú handicap**, **Menú juego**) edit native text with per-label apply, discard and restore. Each field shows its font and character limits. Training descriptions and handicap instructions support multiple lines; shared labels retain their shared uses. Game-start replacements accept up to 15 characters in the tall font.

## Scenarios

**SCENARIOS** edits all 12 ISS Deluxe USA challenges: remaining time, teams, scores, stadium, weather, starting play and displayed 1–5 star rating. The star rating is independent of AI difficulty.

Descriptions have six lines of up to 26 characters using the original alphabet; save them with **Apply description to ROM**. The selector's two-line summary updates with teams, score, time and starting play.

Click or drag the ball on the pitch, or use arrow keys and numeric coordinates. Goal kicks and corners lock the controls to automatic positions based on the stadium; throw-ins and free kicks allow manual placement. Original off-field positions are preserved. Advanced controls expose low and high coordinate bytes. Applied changes support history, restoration, project backups and ROM export.

## Stadiums

**Estadios / Stadiums** edits eight USA slots: Japan, U.S.A., Spain, Italy, England, Germany, Brazil and Nigeria. Names allow up to seven uppercase letters, spaces and periods, independently of team names.

The selector uses dimensions in yards (100–140 × 64–96). Advanced match limits use length 1792–2176 and width 576–704, in steps of 64. Scenarios use these live dimensions for ball placement. Changing limits does not rebuild graphic tilemaps; check markings and wall alignment in the emulator.

The design editor exposes 38 native graphic blocks, stadium icons and palettes for weather, stands, cameras, penalties and selection screens. Assembled views preserve native palettes and flips. Darkened context is protected; repeated source pixels update together. The advanced tile view exposes all source pixels. Shared resources are marked and compressed graphics must fit their original capacities. Restore individual designs, palettes, stadiums or all stadium resources.

## Audio

Inspect all 76 original BRR samples, preview waveforms and DSP pitch information, or export decoded WAV files. Preview frequency can be set to 8, 16 or 32 kHz.

WAV replacement accepts 8-bit or 16-bit PCM, mono or stereo, and converts to BRR. Preview before applying. Up to 69 samples can be replaced within fixed storage allocations; looped or fragmented samples may be restricted.

Imported clips are normalized to a common active-signal RMS level with soft peak limiting. **Normalizar audios modificados** normalizes applied replacements together, preserving playback markers and undo. Silence stays silent; in-game event volume and DSP envelopes still affect loudness.

Preview does not fully emulate SNES envelopes, echo or pitch. Playback frequencies are not verified for every event; the 12 kHz inspection reference is not a universal game frequency. Sequenced music editing remains planned.

## Emulator

Open **Emulador**, then click **Iniciar juego** to run a validated export with applied changes and its updated checksum. The [EmulatorJS SNES runtime](https://emulatorjs.org/docs/systems/snes/) downloads from its CDN and requires internet access.

Use **Recargar ROM modificada** after editing or undoing; it restarts with the latest applied changes. **Detener**, leaving the menu or loading another ROM stops emulation. The toolbar provides pause, fullscreen, keyboard and gamepad settings. Copier headers are removed only from the emulator copy.

**Panel de prueba** sends timed button presses to player 1 or 2. **Guía para ir al selector** explains native menu navigation; **Cancelar secuencia** releases pending input. Save up to eight named screen bookmarks and restore them with **Ir a**. Bookmarks stay in memory and clear when reloading, stopping or leaving the emulator.

## Interface languages

Spanish, Portuguese and English are available. The initial locale follows the browser, with Spanish as fallback; the choice persists in `localStorage`. Edited names and binary ROM data are preserved. Changing the language while the emulator is open restarts emulation.
