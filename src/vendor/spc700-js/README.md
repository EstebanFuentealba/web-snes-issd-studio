# spc700-js

ISC-licensed SPC700/S-DSP emulator by Mitsutaka Okazaki.

Upstream: https://github.com/digital-sound-antiques/spc700-js
Pinned commit: `2d9ce62c2e3ea719e0ba804f91880d8ec8c23da7`.

`index.mjs` is the unminified ES2020 ESM bundle of upstream `src/index.ts`,
generated with the repository's existing esbuild (`bundle: true`, `format: esm`,
`target: es2020`). No upstream code was changed. See LICENSE.md.
It contains emulator code only, with no game ROMs, samples or SPC files.
