# ⚽ Web ISSD Studio

<p align="center">
  <img src="public/logo-issd-studio.png" width="600" alt="Web ISSD Studio" />
</p>

Open-source, browser-based ROM editor for **International Superstar Soccer Deluxe** on SNES, with support for the original **International Superstar Soccer**. Work in progress.

**[Open the editor](https://estebanfuentealba.github.io/web-snes-issd-studio/)**

## Features

- Edit teams, players, uniforms, colors and formations.
- Customize team groups; add or remove teams in ISS Deluxe.
- Draw or import pixel art for flags, labels, menus and game graphics.
- Edit ISS Deluxe scenarios, stadiums and menu text.
- Preview and export audio samples; replace supported samples from WAV files.
- Autosave locally, undo/redo, back up projects as JSON and export modified ROMs.
- Test applied changes with the integrated SNES emulator.
- Use the interface in Spanish, Portuguese or English.

## Quick start

1. [Open the editor](https://estebanfuentealba.github.io/web-snes-issd-studio/) and load your own USA ROM (`.sfc` or `.smc`, with or without a 512-byte copier header).
2. Edit resources and apply any pending graphic or audio previews.
3. Export the modified ROM or open **Emulador** to test it.

ROM processing happens in your browser; the original file is preserved. ROMs are not included. Features vary by game; the advanced editors target ISS Deluxe USA. Other regions and third-party expanded ROM hacks are not supported. The emulator requires internet access to download its runtime.

## Local development

Requires Node.js and npm.

```bash
npm ci
npm run dev
```

```bash
npm test       # Run available checks
npm run build  # Build for production
```

## Documentation

- [Editor guide](docs/editor-guide.md): workflows, resource limits and emulator controls.
- [Development guide](docs/development.md): setup, ROM tests, technical references and optional WebAssembly build.
- [Implementation roadmap](ISSD-Editor-Plan.md).

## Credits and legal notice

Based on research and tools by [Rodrigo Mallmann Guerra](https://github.com/rodmguerra/issparser), [Vladimir Protopopov](https://github.com/ProtonNoir/SNES-decompression-tools) and [sergiomanzur](https://github.com/sergiomanzur/issd-native).

Special thanks to [**Twin Eagles Group (TEG)**](https://tegperu.org/) for the Futebol Brasileiro ROM hacks, some of the first ROM hacks I ever played; [**Chatty (FECIC)**](https://www.romhacking.net/community/6488/) for the ISSD editing tools; and [**Equipe Falcon Brasil**](https://equipefalconbrasil.blogspot.com/) for the new ROM hacks they have released. Thank you all for inspiring me to create this project.

Independent fan project, unaffiliated with Konami or Nintendo. Game names and assets belong to their respective owners. Use ROMs obtained in accordance with applicable laws.


<p align='center'>
<br />
<br />
From Talcahuano 🇨🇱 with ❤️ and lots of water 💧
</p>
