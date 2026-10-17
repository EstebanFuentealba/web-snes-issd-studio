# Editor guide

[Back to README](../README.md) · [Development guide](development.md)

## Supported ROMs and projects

The editor accepts USA versions of ISS and ISS Deluxe in `.sfc`, `.smc`, or linear `.fig` format, with or without a 512-byte copier header. It also recognizes 2 MB ISSD hacks with renamed/erased headers or changed region fields by checking independent engine signatures and the native team pointer/graphics tables. File extensions and titles alone do not identify a compatible hack. Interleaved, expanded, or substantially relocated external ROM layouts are not automatically supported. ISS has 27 teams with 15 players each; ISS Deluxe has 36 national teams and six All-Star teams, with 20 players per team. Advanced editing features described below target ISS Deluxe USA.

Load a ROM from your own collection, choose a resource, edit it and apply pending previews before exporting. The original file stays unchanged. Projects autosave in IndexedDB and are identified by SHA-256; export a JSON backup to keep a portable copy. “Download project without ROM” saves patches and created teams without embedding the original cartridge. Reopen it by loading the exact original ROM and importing the JSON; its SHA-256 must match. “Download project with ROM” includes the original file. Local autosaves retain the original ROM. Applied changes support undo/redo, restoration and project import/export.

ROM export validates binary changes and recalculates the SNES checksum while preserving file size and the copier header. Exporting an unchanged project produces the original ROM. Test modified exports in an emulator or on hardware, especially after graphic relocation or native game patches.

## Teams, players and formations

Edit team names, graphical labels, flags, uniforms and player names, shirt numbers, positions, attributes, hairstyles and skin colors. Player names occupy eight game-encoded bytes. Large team names have a capacity specific to each slot; small labels must fit within 32 pixels.

Click a player row or its ▶ button to open the inspector. It shows eight original player views, clickable statistics, keyboard controls and manual rotation. Only one inspector opens at a time. The roster pitch shows the saved formation and eleven starters, with substitutes below; selecting a shirt number opens that player's row. On smaller screens, **Cancha** opens a floating pitch.

In **Teams → Formation**, choose one of 16 schemes, drag outfield players or adjust coordinates with keyboard and numeric controls. **Attack Participation** sets the attacking role of defenders and midfielders. Yellow arrows mark active roles; forwards have no participation flag and the engine positions the goalkeeper. Use **Apply formation** or **Discard changes**, or copy another team's original formation.

### Groups and team management

**Grupos** lets you rename the seven original groups, create up to 16 groups and assign teams. A team may appear in multiple groups. Empty groups are hidden and at least one team must remain, except when explicitly creating an empty ROM template.

**Configuración → Columnas de banderas** offers six teams per page (3 columns × 2 rows) or four (4 columns × 1 row). Larger groups span multiple pages using the same title. Each group accepts up to 42 teams. Custom groups control All-Star visibility; otherwise, configuration can preserve, show or hide the original All-Star page.

**Configuración → Mostrar árbitro perro** enables the dog referee, its animations and barks in the exported ROM. Uncheck it to use human referees even after entering the dog cheat code. The setting is saved with the project and supports undo, redo and restoration.

**Equipos → Nuevo equipo → Agregar equipo** supports up to 48 existing teams. It reuses compatible deleted original slots before allocating one of six extra slots. New extra slots support large names of up to ten characters (A–Z, periods and spaces); original slots retain their own name and graphic limits. New teams copy Italy's current roster and resources, or the first existing team if Italy was deleted, and appear in **EXTRA**.

- **Eliminar equipo de los grupos** hides a team from all selection groups while retaining its data and ID. Add it back through **Grupos**.
- **Eliminar físicamente de la ROM** clears team data and resources unused by remaining teams. Original IDs remain stable, extra slots are compacted and scenario references are reassigned. Native references to deleted IDs use the first existing team; tournaments keep their original formats.
- **Crear ROM sin equipos** creates a template with no active teams or visible groups. A hidden roster template allows creating the first team, whose flag starts white. Save, export, reopen or undo the template normally; create at least one team before starting the emulator.

Legacy drafts remain at 2 MiB until expansion is needed. Creating team 49 or applying a 9–10-character player name migrates the draft to a 4 MiB LoROM; the Studio supports up to 56 teams and preserves the optional copier header. Expansion can be undone, and saved projects and exported ROMs can be reopened. Every expanded squad has its own 200-byte name record, attributes, palettes, flags and small label. Selection buffers bound this format to 56 teams; a larger limit is not enabled. Physical deletion retains the draft’s current ROM size. Shared original graphics retain their constraints. In empty-template projects, original flag and label previews use the new team's creation reference; reopening an exported ROM uses its saved graphics as the original reference.

## Graphics and palettes

The graphics selector groups all 30 native dog referee sprites into one editable 360 × 200 sheet containing 45 assembled poses. Each row is a direction (up, diagonally up, side, diagonally down, down); columns 1–4 are standing poses and columns 5–9 are running frames. Transparent spacing between poses is protected. They use the original dog palette. Mirrored directions and standing variants reuse tiles, so edits apply to all appearances of those tiles. Dog artwork is global and supports drawing, image import, undo, redo and restoration.

The Pixel Art Maker edits native tiles and palettes for flags, labels, player and goalkeeper sprites, hairstyles, shirt numbers, ball graphics, logos and other screens. Import PNG, JPG, WebP, GIF or BMP images with cropping, resizing, color quantization and preview. You can preserve the original palette, flip artwork or restore resources.

- Flags use 24 × 16 pixels and up to four colors; small team labels use 32 × 8 pixels.
- Uniform drawing covers eight player and goalkeeper directions; shared source pixels update together.
- Uniform, goalkeeper, skin, hair and flag colors use SNES BGR555 palettes. Team colors are isolated automatically; shared sprite artwork still affects its other uses.
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

The Samples and Música tabs share the dark studio theme, including sample controls, storage usage, upload and trimming panels. ROM sample previews show a named track, waveform, playback cursor and transport controls (play, pause, stop, seek and repeat). Click the track or use arrow/Home/End keys to seek; Space toggles playback.

Inspect all 76 original BRR samples, preview waveforms and DSP pitch information, or export decoded WAV files. Preview frequency can be set to 8, 16 or 32 kHz.

WAV replacement accepts 8-bit or 16-bit PCM, mono or stereo, and converts to BRR. Preview before applying. Up to 69 samples can be replaced within fixed storage allocations; looped or fragmented samples may be restricted.

Imported clips are normalized to a common active-signal RMS level with soft peak limiting. **Normalizar audios modificados** normalizes applied replacements together, preserving playback markers and undo. Silence stays silent; in-game event volume and DSP envelopes still affect loudness.

**Configuración → Quitar reverberación de los relatos** disables the game's echo send on the commentary channel in the exported ROM, including long voices. Other channels retain their echo settings. The setting supports undo and saved projects; unchecking restores the original echo behavior. It cannot remove reverb already recorded in an imported audio file. The control is unavailable for WC26 and unrecognized sound drivers.

Preview does not fully emulate SNES envelopes, echo or pitch. Playback frequencies are not verified for every event; the 12 kHz inspection reference is not a universal game frequency. Read-only sequenced music inspection and SPC playback are available separately in the Música tab (see below).

## Emulator

Open **Emulador**, then click **Iniciar juego** to run a validated export with applied changes and its updated checksum. The [EmulatorJS SNES runtime](https://emulatorjs.org/docs/systems/snes/) downloads from its CDN and requires internet access.

Use **Recargar ROM modificada** after editing or undoing; it restarts with the latest applied changes. **Detener**, leaving the menu or loading another ROM stops emulation. The toolbar provides pause, fullscreen, keyboard and gamepad settings. Copier headers are removed only from the emulator copy.

**Panel de prueba** sends timed button presses to player 1 or 2. **Guía para ir al selector** explains native menu navigation; **Cancelar secuencia** releases pending input. Save up to eight named screen bookmarks and restore them with **Ir a**. Bookmarks stay in memory and clear when reloading, stopping or leaving the emulator.

## Interface languages

Spanish, Portuguese and English are available. The initial locale follows the browser, with Spanish as fallback; the choice persists in `localStorage`. Edited names and binary ROM data are preserved. Changing the language while the emulator is open restarts emulation.

### Audio JSON packs

In Audio, **Exportar paquete de audio JSON** saves all 76 catalog BRR allocations losslessly. **Importar paquete de audio JSON** applies a pack to the current ROM as one undoable transaction, preserving other project changes. It validates sample names, sizes and the destination playback markers for streamed/looping banks. These banks can be transferred intact but remain unavailable for WAV replacement/normalization. Packs do not include sequenced music, SPC driver/event settings, or uncatalogued sounds. Hacks that relocate samples or change the playback protocol require separate analysis.

### Legacy ISSD hacks

Futebol Brasileiro ’96 and Ronaldinho ’97 have been checked for loading all 42 squads and 76 BRR samples, player editing, export, exact unchanged export, project recovery and undo. The original hack is the project baseline; the editor preserves its copier header and internal title/region fields. These hacks use 32 × 16 team labels, which can be drawn in place without relocating them into the Studio’s smaller label pool. Large-name text editing, menus, challenges and some composite title graphics use different structures and are reported as unavailable instead of blocking the entire editor. Recognition is not a guarantee for every ISSD hack or every feature.

### WC26 relocated roster profile

`ISSDWC26RC1GB2.0.sfc` uses 56 squads, 20 players each, 10-byte names in bank `$AF`, and attributes at unheadered offset `$150000`. The Studio recognizes its loader and directory structure and uses the same Studio menu and views as native ISSD, with a layout adapter for relocated data. All 56 squads support name, number, position, statistic, hair and skin edits, original restoration, undo/redo, autosave, portable projects and ROM export. Only verified allocations are writable; flags, labels, palettes and formations follow the WC26 directories, while scenarios, stadium graphics, palettes, dimensions and catalog audio follow their verified locations. Existing duplicate numbers in the source ROM are preserved; edits cannot increase the number of duplicates. Changes should still be tested in the emulator because this hack includes runtime checks. Opening a ROM from the file input, drop zone, or project import resets the router to Resumen; automatic restoration on page refresh preserves the current section.

### WC26 team and resource inspection

The WC26 profile follows the relocated 56-entry flag, label and palette directories, the 58-frame large-name asset and its runtime frame pointers. Country names are decoded from the repacked glyph IDs, rather than inferred from a goalkeeper or copied from USA slot labels. The team selectors expose all 56 real country names; Equipos shows the native name graphics and formations. Grupos follows the actual four-team page order (12 tournament pages plus two additional pages). Appearance uses the relocated home/away/goalkeeper/skin/hair palettes and native player sprite descriptors, including the relocated shirt-detail table. Players support all eight menu rotations. Graphic editing preserves native flag/label allocations and identifies shared resources.

Audio exposes the 76 fixed catalog samples, WAV replacement where the BRR structure permits it, and lossless JSON packs. The original scenario records, descriptions, summaries, difficulty and eight stadium measurement records are readable and editable; scenario summaries use WC26 country names. The relocated main-menu composition and other menu text previews are available for inspection. Menu editing, large-name text rewriting, stadium scene editing, team expansion and engine patches remain outside this profile’s verified write registry. All supported mutations use the same project recovery and undo history.

WC26 uses the existing roster table, PlayerInspector, RosterPitch, FormationEditor, GroupEditor, MenusEditor, StadiumEditor and audio views. Unverified menu/group writes are disabled in those views; stadium measurements remain editable. Player names use the profile’s 10-character limit. Team expansion and engine settings are disabled for this layout.

WC26 flags retain their own directory entries for all 56 teams, including the eight extra squads. Their preview combines the four team colors with the menu’s shared sprite colors; Senegal, South Africa, Panama and Bolivia also use the shared yellow/red inks at pixel indices 5 and 6. Grupos and Gráficos consume the same decoded artwork and palette.

### WC26 graphic editing

Gráficos now uses Pixel Art Maker for the shared player and goalkeeper sprites, relocated shirt details, shirt numbers, ball, all thirteen hair atlases, the dog referee sheet, five title portraits, main-menu font/panel/background and mode/password artwork. These resources use the same pixel ownership and palette rules as the native editor, preserve each original allocation, and support image import, restoration, undo/redo, project recovery and export. Changes to shared artwork affect all its uses; shirt-detail sharing is resolved through WC26's 56-entry directory. Applying unchanged artwork preserves the original compressed bytes. Graphics whose layout cannot be decoded are reported individually instead of hiding the whole editor. WC26's title logo and blue background follow its actual DMA sources: the base BG atlas, the trophy overwrite at VRAM $26F0 and the OAM text atlas. They preserve the original tilemaps, flips, palettes, OAM positions and compressed allocations. Large-name rewriting, intro-screen repacking and menu text rewriting still require separate WC26 storage verification.

WC26 stadium editing includes 38 graphic resources, native assembled views, selector weather graphics and per-stadium miniatures. The adapter reads the stadium upload scripts for the relocated poster at `$9BFA90` and ground/walls at `$878486`; obsolete addresses contain other assets and are never written. Editing preserves the original compressed reservation across repeated changes, and supports palette edits, restoration, undo/redo and project/ROM recovery. Stadium name rewriting remains disabled for this profile.

### Uniformes y foto del equipo

En **Apariencia**, elige Tipo 1/local, Tipo 2/visitante o Portero. Los colores se
editan desde una vista grande del jugador: selecciona **Camiseta**, **Pantalón**
o **Medias**, luego un tono y el selector de color o **RGB** (0 a 31). Al cambiar
el **Color primario**, el editor pregunta si deseas generar los demás tonos de
la prenda, aplicar solo ese color o cancelar. La vista previa muestra los tonos
propuestos; el conjunto se guarda y se deshace como una sola operación.
Los colores adicionales, el dibujo por píxeles y la foto permanecen plegados
hasta que los necesites. Cada cambio se aplica al equipo seleccionado.
Las paletas compartidas se separan automáticamente. En ROMs nativas que necesitan
esa separación se utiliza la expansión existente a 4 MiB; WC26 conserva 2 MiB.

**Dibujar camiseta y pantalón** permite dibujar, borrar, rellenar e importar una
imagen sobre las prendas de las ocho direcciones. Selecciona una zona para
proteger las otras prendas y la cabeza. Pulsa **Aplicar gráfico a la ROM** para
guardar el dibujo. Los colores son independientes por equipo; los tiles del
cuerpo se comparten entre equipos y entre los dos uniformes.

La **Foto del equipo en selección** tiene su propia vista y colores. Su botón
abre el editor de píxeles con importación y exportación de imágenes. Los gráficos
compartidos afectan a sus otros usos; el dibujo conserva la silueta de los sprites
y debe caber en el espacio comprimido original. El fondo del estadio es otro
recurso y no se reemplaza con esta foto.

### Music (SPC700)

Audio has two tabs: **Samples** retains the BRR/voice tools; **Música** is a
read-only music studio. Inspect the native song channels in Playlist, Song
Navigator and Piano Roll. Select notes to see pitch, duration and velocity as
text. Use horizontal/vertical zoom, scroll, panel resizing and the song/channel
selectors to explore. There are no note editing, drawing, duration, clipboard,
MIDI, new-sequence, apply, restore or musical undo/redo controls or
mutation shortcuts. Previously applied project music is still displayed as saved;
opening the studio does not undo those changes.

Play/pause/stop and repeat execute the SPC700 driver. Each track's **Solo**
button isolates its voice; press it again to restore the full mix. Click or drag
the rulers or orange cursor to seek; running playback resumes on release.
View settings are stored for the browser session and do not change ROM bytes.
The 48-PPQN ruler uses a reference 4/4 grid. Native loops remain visible across
the shared span; a region can include rests between its note thumbnails.

**Subir archivo SPC** accepts only `.spc`. Native ISSD and other games' snapshots
both open in a separate read-only player with original driver/instruments,
metadata, playback, seeking in seconds and Solo for the eight DSP voices.
Loading a file never imports its sequence into the project or writes to the ROM.
**Volver a las canciones de la ROM** returns to the previous native view. Invalid
files leave the previous preview intact. Metadata sets the preview duration where
available (otherwise 185 seconds), capped at one hour.

**Exportar SPC** downloads the currently selected ROM song as a standalone SPC
without modifying the project. It is disabled while a separately uploaded SPC is
open; return to ROM songs to export one.
