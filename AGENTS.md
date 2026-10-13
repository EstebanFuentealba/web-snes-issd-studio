# Pruebas obligatorias con Snes9x

Estas instrucciones se aplican a todos los cambios futuros de este repositorio.
El usuario exige verificar los cambios con el núcleo real de Snes9x mediante
`SNES9X_CORE`, además de ejecutar los tests pertinentes al cambio.

## Antes de dar un cambio por terminado

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

## Configuración y comando

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

## Cobertura y archivos de prueba

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
