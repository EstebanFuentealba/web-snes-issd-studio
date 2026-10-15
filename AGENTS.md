# Guía para agentes de Web ISSD Studio

Estas instrucciones se aplican a todo el repositorio. Antes de implementar una
función, leer esta guía y las secciones pertinentes de la documentación.

## Objetivo y alcance

Editor de ROMs de SNES ejecutado en el navegador, construido con Vue 3,
Vue Router 4 y Vite. Permite editar equipos, jugadores, uniformes, gráficos,
formaciones, grupos, escenarios, estadios, textos y audio, guardar proyectos
JSON y exportar ROMs. Los datos se procesan localmente; los proyectos se guardan
en IndexedDB. Las vistas gráficas usan Canvas y el audio usa Web Audio.

El perfil principal es International Superstar Soccer Deluxe USA. También hay
soporte para International Superstar Soccer USA, determinados hacks y el perfil
WC26. Las capacidades dependen del perfil detectado: no asumir que los offsets,
las tablas ni los parches del motor nativo funcionan en otra ROM.

## Lecturas iniciales

- `README.md`: instalación, alcance general y limitaciones.
- `docs/editor-guide.md`: flujos de usuario y restricciones de cada editor.
- `docs/development.md`: formatos, memoria, hooks y referencias técnicas.
- `ISSD-Editor-Plan.md`: ideas y planificación; contrastarlas con el código
  actual antes de dar una función por implementada.
- `package.json`: comandos y lista actual de pruebas. No hay un comando de lint
  configurado; no inventar uno ni añadir herramientas sin necesidad.

## Preparar el entorno

Usar Node.js y npm compatibles con el lockfile y las dependencias actuales.

```sh
npm ci
npm run dev
```

- `npm test`: batería de pruebas indicada en `package.json`.
- `node tests/<archivo>.cjs`: ejecutar una prueba concreta del área modificada.
- `npm run build`: compilar para producción en `dist/`.
- `npm run preview`: servir la compilación localmente.
- `npm run test:expanded-runtime`: integración con el núcleo real de Snes9x;
  su configuración obligatoria se detalla más abajo.
- `npm run build-wasm`: módulo nativo opcional, requiere Emscripten. La lectura
  de ROMs funciona en JavaScript; no es necesario reconstruir WASM para cambios
  normales de interfaz o lógica JavaScript.

Usar `package-lock.json` con npm; no actualizar dependencias ni lockfiles como
parte incidental de otra tarea. El emulador de la interfaz descarga su runtime
EmulatorJS desde una CDN y necesita internet; el runner de Snes9x usa una
biblioteca libretro local y Python 3.

## Mapa del código

| Ubicación | Responsabilidad |
| --- | --- |
| `src/components/StudioEditor.vue` | Integración del editor y sus operaciones. |
| `src/components/` | Editores por área, PixelEditor y RomEmulator. Buscar primero un componente existente para extenderlo. |
| `src/views/Home.vue`, `src/App.vue`, `src/main.js` | Entrada de la aplicación y carga inicial. |
| `src/navigation.mjs`, `src/router.js` | Secciones y rutas del Studio. |
| `src/rom/project.mjs` | `RomProject`, registro de recursos permitidos, validación de parches, transacciones, historial, importación y exportación. |
| `src/rom/project-store.mjs` | Persistencia de proyectos en IndexedDB. |
| `src/rom/binary.mjs` | Apertura y detección de ROMs, cabeceras, direcciones LoROM, descompresión, tiles y paletas. |
| `src/rom/studio.js`, `src/rom/deluxe.mjs` | Lectura de equipos e integración de perfiles ISS/ISSD. |
| `src/rom/compatibility.mjs`, `src/rom/external-layout.mjs`, `src/rom/wc26-*.mjs` | Capacidades y adaptadores de layouts externos. |
| `src/rom/expanded-layout.mjs`, `src/rom/expanded-teams.mjs`, `src/rom/team-hooks.mjs` | Expansión de equipos, distribución de memoria y parches del motor. |
| `src/rom/` | Codecs y lógica por área: jugadores, gráficos, uniformes, audio, textos, estadios, escenarios y grupos. |
| `src/models/`, `src/handlers/` | Modelos y lectores existentes, utilizados también por el perfil ISS. |
| `src/i18n/` | Traducciones y utilidades de idioma. |
| `tests/` | Scripts Node `.cjs`, pruebas CPU y runner Python de Snes9x. |
| `cpp/`, `public/wasm/` | Utilidades nativas y módulo WASM opcional. |
| `public/emulator/` | Integración del emulador de navegador. |

## Flujo para crear o corregir funciones

1. Revisar `git status --short` y el código del área. Conservar cambios previos,
   incluidos archivos nuevos y cambios staged; no revertirlos ni sobrescribirlos.
2. Identificar perfiles afectados, recursos binarios y prueba más cercana.
   Reutilizar los componentes, codecs y adaptadores existentes.
3. Mantener lectura, codificación y generación de parches en `src/rom/`;
   dejar interacción y presentación en los componentes Vue. Seguir el estilo
   local del archivo y evitar refactorizaciones ajenas a la tarea.
4. Integrar las escrituras con `RomProject` y su registro de recursos permitidos.
   Validar ID, offset, tamaño y contenido antes de aplicar un parche. Agrupar
   una acción del usuario en una transacción para deshacerla de una sola vez.
5. Comprobar restauración desde la ROM original del proyecto, undo/redo,
   guardado local, exportación/importación JSON y exportación/reapertura de ROM.
   Mantener legibles los proyectos anteriores al cambiar formatos; validar
   entradas inválidas y conservar las ediciones del usuario al migrar.
6. Exponer controles según capacidades del perfil. Dar una razón concreta si
   una operación no está verificada; no habilitar escrituras por suposiciones.
7. Añadir las traducciones, pruebas y documentación afectadas. Si se crea un
   test, incorporarlo al comando correspondiente para que se ejecute realmente.
8. Ejecutar las validaciones requeridas más abajo y revisar el diff final.
   Entregar qué cambió, qué se probó y qué quedó pendiente con su causa.

## Reglas al manipular ROMs

- Conservar el archivo original. Trabajar mediante copias y parches validados;
  no modificar silenciosamente la base usada para restaurar o recuperar proyectos.
- Distinguir offsets de archivo sin cabecera, direcciones SNES y posiciones en
  RAM/VRAM. Usar los helpers y el layout correspondiente. Soportar la cabecera
  opcional de 512 bytes y conservarla al exportar según el contrato existente.
- No deducir el layout solo por el nombre del archivo o la etiqueta del juego.
  Respetar detección estructural, capacidades y registros de escritura por perfil.
- Respetar límites de tablas, bancos, punteros, tilemaps, paletas BGR555,
  transparencias y capacidad comprimida. Ampliar un control de UI no amplía el
  espacio de la ROM. Una reubicación exige actualizar lectores, punteros y hooks.
- Antes de reservar memoria, revisar `docs/development.md`, constantes de layout
  y parches existentes. Documentar cada rango nuevo y comprobar colisiones,
  recursos compartidos y compatibilidad entre expansiones de equipos y audio.
- Mantener el tile transparente global de 32 bytes en `$98F014`: lo comparten
  jugadores, árbitros y regiones vacías. No rellenarlo con detalles de camisetas.
- Los hooks 65816 deben respetar modos de acumulador/índice, registros, pila,
  banco de datos, mirrors LoROM y DMA. Una simulación CPU parcial ayuda a depurar,
  pero no sustituye ejecutar el núcleo real con CPU y PPU.
- Mantener identidad binaria en operaciones sin cambios donde el contrato lo
  exige y preservar datos ajenos al recurso editado. Exportar usando la lógica
  existente de tamaño y checksum en `RomProject.exportRom()`.
- En audio, respetar bloques BRR, bucles, segmentos, marcadores de reproducción,
  presupuesto de memoria y protocolo del driver. Escuchar una previsualización
  Web Audio no demuestra el comportamiento del DSP durante un partido.

## Interfaz e idiomas

Mantener los flujos de aplicar, descartar y restaurar de cada editor. Diferenciar
la previsualización pendiente de los cambios aplicados que llegan al emulador
y a la ROM exportada. Indicar claramente cuándo un gráfico o una paleta se
comparte con otros equipos o pantallas.

Usar las utilidades existentes de i18n (`$t(text)` y `$locale`) y completar
`src/i18n/messages.json` para español, portugués e inglés. Conservar los
placeholders `{0}`, `{1}`, etc. Los nombres editados y demás datos de la ROM
no deben traducirse al cambiar el idioma. Ejecutar `node tests/i18n.cjs` cuando
se cambien textos visibles y `node tests/navigation.cjs` si se alteran rutas.

## Pruebas por área

Consultar `package.json` y los scripts existentes para elegir los pertinentes.
Ejemplos de puntos de entrada:

| Área | Pruebas |
| --- | --- |
| Proyecto y exportación | `tests/editor.cjs`, `tests/rom.cjs` |
| Perfiles y hacks | `tests/hack-roms.cjs`, `tests/wc26*.cjs` |
| Equipos y expansión | `tests/expanded-teams.cjs`, `tests/expanded-teams-cpu.cjs`, `tests/physical-teams*.cjs`, `tests/team-removal.cjs` |
| Uniformes y jugadores | `tests/kits.cjs`, `tests/player-preview.cjs` |
| Audio | `tests/audio-*.cjs`; revisar cuáles son harnesses o módulos de runtime antes de ejecutarlos aisladamente |
| Menús y textos | `tests/main-menu.cjs`, `tests/menu-text.cjs`, `tests/screen-text.cjs` |
| Estadios, escenarios y formaciones | `tests/stadium*.cjs`, `tests/scenarios.cjs`, `tests/formations.cjs`, `tests/formation-editor-ui.cjs` |
| Grupos y gráficos compuestos | `tests/groups.cjs`, `tests/group-renderer.cjs`, `tests/composition.cjs` |

Los patrones de esta tabla son una guía para localizar archivos; ejecutar cada
script elegido o `npm test`, no pasar varios archivos al comando `node` como si
fuera un runner de tests. Si el cambio es transversal, ejecutar `npm test`.
Los módulos de runtime se integran desde `tests/expanded-teams-runtime.cjs`;
revisar y actualizar esa entrada al incorporar nuevas regresiones de juego.

## Archivos locales y evidencia

Las ROMs locales viven en `roms/` (ignorado por Git). La suite utiliza los nombres
`International Superstar Soccer (USA).sfc` y
`International Superstar Soccer Deluxe (USA).sfc`. Obtenerlas únicamente de los
archivos locales del usuario. No descargar ni versionar ROMs, exportaciones con
contenido del juego ni bibliotecas compiladas del núcleo.

Conservar capturas pertinentes en `artifacts/`, actualmente ignorado por Git;
indicar su ruta en la entrega. No forzar la inclusión de ROMs ni añadir todas
las salidas temporales. No versionar `node_modules/` ni `dist/`. Revisar el diff
para evitar incluir material local o cambios previos ajenos.

## Pruebas obligatorias con Snes9x

Estas instrucciones se aplican a todos los cambios futuros de este repositorio.
El usuario exige verificar los cambios con el núcleo real de Snes9x mediante
`SNES9X_CORE`, además de ejecutar los tests pertinentes al cambio.

### Antes de dar un cambio por terminado

1. Ejecutar `npm run test:expanded-runtime` con `SNES9X_CORE` configurado y la
   ROM USA local disponible. Un resultado `SKIP` **no cuenta como validación**.
2. Ejecutar los tests del área modificada. Para cambios de código de la
   aplicación, ejecutar también `npm run build`.
3. Si el cambio modifica un comportamiento que la prueba de runtime todavía
   no cubre, añadir un caso de regresión que lo reproduzca y compruebe su
   resultado en Snes9x. No basta con que los bytes exportados sean válidos.
4. Cuando el usuario adjunte un proyecto que falla, reproducirlo con su ROM
   original y verificar la corrección conservando sus ediciones.
5. Revisar las capturas generadas cuando el cambio afecte gráficos o texto.
   Informar qué se probó y cualquier limitación real de la verificación.

No afirmar que una ROM funciona en el juego basándose únicamente en tests de
JavaScript, simulaciones parciales de 65816 o una compilación correcta. Si falta
algún requisito y no es posible conseguirlo, completar el trabajo independiente
y explicar que la verificación con Snes9x quedó pendiente.

### Configuración y comando

`SNES9X_CORE` debe apuntar a una biblioteca **libretro** de Snes9x (`.dylib`,
`.so` o `.dll`), no al ejecutable de una aplicación de escritorio.

En este equipo se compiló y verificó esta biblioteca:

```sh
export SNES9X_CORE="${SNES9X_CORE:-/private/tmp/issd-snes9x-check/libretro/snes9x_libretro.dylib}"
test -f "$SNES9X_CORE"
test -f "roms/International Superstar Soccer Deluxe (USA).sfc"
npm run test:expanded-runtime
```

Comprobar que **ambos** `test -f` tengan éxito antes de ejecutar el test. La ruta
en `/private/tmp` es temporal: no asumir que seguirá existiendo en otra sesión.
Respetar un `SNES9X_CORE` que ya esté configurado.

Si falta el núcleo, usar una biblioteca disponible o compilar el código oficial
de [Snes9x libretro](https://github.com/libretro/snes9x) en un directorio temporal:

```sh
git clone --depth 1 https://github.com/libretro/snes9x.git /private/tmp/issd-snes9x-check
make -C /private/tmp/issd-snes9x-check/libretro -j4
```

No clonar sobre un checkout existente. Localizar la biblioteca generada para la
plataforma actual y configurar su ruta. No añadir ROMs ni binarios del núcleo al
repositorio. La ROM de prueba debe proceder de los archivos locales del usuario.

### Cobertura y archivos de prueba

- `tests/expanded-teams-runtime.cjs`: prepara la ROM expandida y controla la
  secuencia de botones de forma reproducible.
- `tests/snes9x-headless.py`: ejecuta el núcleo libretro sin automatización de UI.
  Requiere Python 3 y utiliza solamente su biblioteca estándar. Se puede elegir
  el intérprete mediante `PYTHON`.
- `docs/development.md`: documenta la distribución de memoria y los hooks.

La prueba actual comprueba menú principal, paletas del selector, selección del
equipo 56, cachés de banderas y rótulos de los 56 equipos, sprites de nombres,
I. MILAN en handicap y un partido con nombres de diez caracteres. También verifica los tiles del nombre
que llegan a **VRAM**, no solamente el contenido del búfer de nombres en RAM.

El test imprime el directorio temporal con las capturas PNG y los volcados de
RAM/VRAM. Conservar evidencia útil de fallos y correcciones. Para entregas,
guardar las capturas pertinentes en `artifacts/` y no incluir la ROM en Git.
