# terminus-landing

La página de **Terminus** — [terminus.danil.ai](https://terminus.danil.ai).

Sitio estático hecho con [Astro](https://astro.build). Una sola página
(`src/pages/index.astro`) y su hoja de estilo (`src/styles/global.css`). Oscura,
tipografía Geist, sin dependencias de runtime.

## Desarrollo

```bash
pnpm install
pnpm dev       # servidor local con recarga en caliente
pnpm build     # build de producción a dist/
pnpm preview   # sirve el build para revisarlo
```

## Estructura

```
src/pages/index.astro         La página entera: hero, «Cómo funciona», cierre.
src/components/Demo.astro     El marco de la demo: un iframe a /demo/, pintado
                              a ancho de escritorio y escalado al que haya.
src/components/MarcaAgente.astro  Las marcas de los agentes, copiadas de
                              harness-app/src/ui/icons.tsx.
demo/simulador.js             El backend simulado de la demo: espacios,
                              proyectos, encargados, tareas, cuentas y el
                              turno guionado del agente.
scripts/demo.mjs              Compila la demo desde una checkout de harness-app.
public/demo/                  La demo compilada. Entra al repo: el CI no puede
                              leer harness-app, que es privado.
src/styles/global.css         Tokens de marca y estilos de la página. Los
                              colores salen del sistema de diseño; aquí no se
                              inventan.
public/marca/                 Logo e isotipo.
public/fuentes/               Geist Sans y Geist Mono (variables).
wrangler.jsonc                Configuración de despliegue a Cloudflare.
```

## Reglas visuales

- Oscura. Fondo navy, CTA amarillo. Verde para «disponible/conectado».
- Geist Sans + Geist Mono (el mono es dato real: comandos, rutas).
- Superficie sólida, borde hairline, sombra chica. **Sin glassmorphism, sin
  `backdrop-filter`, sin gradientes decorativos.** Radios 4/6/8.
- Copy en español, tono de ingeniero. Sin relleno de venta.
- **Nada que la app no haga hoy.** Cada frase tiene que poder comprobarse en
  `harness-app` — su `ARCHITECTURE.md` y sus catálogos de `src/locales/es/`. Lo
  que es visión de producto no entra hasta que esté construido: una promesa que
  la primera instalación desmiente cuesta más que no hacerla.
- Los datos no se inventan: la descarga apunta a las releases reales y la
  versión se resuelve al compilar.

## La demo

La ventana que se ve en la página **es la app de verdad**: el front de
`harness-app` compilado tal cual, con el backend de Tauri simulado por
`demo/simulador.js` (la misma técnica que `scripts/mount.mjs` de allá). Abre en
una tarea, como quien vuelve a la app: se cambia de espacio y de carpeta, se
abren tareas y agentes, se toca el árbol del trabajo y Configuración (incluida
Radiant), la apariencia, las fuentes y los consumos; al escribirle al agente
corre un turno guionado que lee archivos, crea un componente, edita la página y
compila. **El agente de la demo dice que su respuesta es simulada.**

**Habla español o inglés.** La página la pide con `/demo/?lang=es` o
`/demo/?lang=en`; sin parámetro usa la lengua del navegador. La interfaz sale
del catálogo real de la app (`src/locales/<lengua>`); los datos de ejemplo
(tareas, agentes, conversaciones, archivos) se traducen en el simulador con
`tr(es, en)`. Los bloques de código no se traducen: citan archivos reales.

**Lo que no tiene guion no hace nada: se bloquea.** La demo no simula conectar
cuentas, instalar, borrar ni crear; en vez de adivinar, `simulador.js` cierra la
puerta por defecto —un clic o una tecla solo accionan lo que está en su lista
de permitidos— y avisa «En la demo esto no está disponible». Así, un botón
nuevo de `harness-app` queda bloqueado por diseño, no por descuido. El guardia
reconoce los botones por su **clave del catálogo**
(`rotulo("shell.sidebar.hide")`), no por su texto, así que vale en las dos
lenguas. Al compilar, `scripts/demo.mjs` busca esas claves en los catálogos de
la app y deja sus textos en `datos.js`; **si la app quita o renombra una clave,
la compilación falla** y dice cuál.

Para regenerarla con otra versión de la app:

```bash
node scripts/demo.mjs <carpeta de harness-app>   # exporta HEAD, no toca la checkout
npm run build
```

`public/demo/VERSION` dice de qué commit de `harness-app` salió. Si la app
agrega comandos, el script les da solo la respuesta vacía que admite su tipo; lo
que tenga algo que enseñar se escribe en el simulador. Para ver qué comandos
contestó vacíos, en la consola de la demo: `[...window.__demoSinGuion]`.

Después de recompilar, revísala en un navegador antes de subirla: que cargue sin
errores, que a los 10 s no salga ningún aviso de conexión, que se abran las
tareas, el árbol de trabajo y Configuración → Radiant, y que un mensaje nuevo
corra el turno guionado — en `?lang=es` y en `?lang=en`.

### Llevarla al sitio unificado de danil.ai

La demo es un sitio estático que vive en `/demo/` y no depende de Astro ni de
esta página. Para moverla al repo `landing_page`:

1. **Copiar** a ese repo:
   - `demo/simulador.js` — el backend simulado (la fuente).
   - `scripts/demo.mjs` — el compilador.
   - `public/demo/` entero — la demo compilada (~30 MB, unos 550 archivos;
     la app parte su bundle y trae los recursos de Excalidraw, Mermaid y el
     visor de PDF, que se cargan solo si se usan). Entra al repo porque el CI no
     puede leer `harness-app`, que es privado.
2. **Servirla en `/demo/`.** El bundle se compila con `--base /demo/` y
   `index.html` carga `/demo/datos.js` y `/demo/simulador.js` con ruta
   absoluta: si va en otra ruta, hay que cambiar `--base` y esas dos rutas en
   `scripts/demo.mjs`. En Astro basta con dejarla en `public/demo/`.
3. **Incrustarla** con un `<iframe src="/demo/?lang=es">` o `?lang=en` según la
   página. El marco que la escala (pintada a 1280×800 y reducida al ancho
   disponible) y el botón «Reiniciar demo» están en `src/components/Demo.astro`;
   se puede copiar tal cual.
4. **El árbol de la demo enseña los archivos de este repo** (`archivosDeLaLanding`
   en `scripts/demo.mjs` lee `git ls-files` de la carpeta donde vive el script).
   Movida al otro repo, enseñará los de `landing_page`. Si se quiere conservar
   el proyecto `terminus-landing`, hay que apuntar esa función a una checkout de
   este repo. Ojo: el turno guionado edita `src/pages/index.astro` y busca
   `import Demo from "../components/Demo.astro"` y
   `<section class="envoltura cierre">` para insertar su componente; con otra
   página, el cambio que enseña será otro (sigue funcionando, pero el diff
   cambia).

Para recompilarla allá hace falta:

- **Node** (el script es ESM, sin dependencias) y **pnpm** (instala las
  dependencias de `harness-app` con `--frozen-lockfile`).
- **Una checkout de `harness-app`** con acceso de lectura. El script exporta su
  `HEAD` con `git archive` a una carpeta temporal y compila ahí con Vite: no
  toca esa checkout, ni compila Rust.
- **Red** la primera vez, para que pnpm baje los paquetes.

## Despliegue

Se publica en Cloudflare con `wrangler deploy` (dominio `terminus.danil.ai`).

---

Terminus es de [Danil](https://danil.ai).
