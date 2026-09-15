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
demo/simulador.js             El backend simulado de la demo: proyectos,
                              tareas, cuentas y el turno guionado del agente.
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
`demo/simulador.js` (la misma técnica que `scripts/mount.mjs` de allá). Se
tocan las barras, las tareas, Configuración, la apariencia, los consumos y el
árbol del proyecto; al escribirle al agente corre un turno guionado que crea un
componente, edita la página y compila. **El agente de la demo dice que su
respuesta es simulada.**

Para regenerarla con otra versión de la app:

```bash
node scripts/demo.mjs <carpeta de harness-app>   # exporta HEAD, no toca la checkout
npm run build
```

`public/demo/VERSION` dice de qué commit de `harness-app` salió. Si la app
agrega comandos, el script les da solo la respuesta vacía que admite su tipo; lo
que tenga algo que enseñar se escribe en el simulador.

## Despliegue

Se publica en Cloudflare con `wrangler deploy` (dominio `terminus.danil.ai`).

---

Terminus es de [Danil](https://danil.ai).
