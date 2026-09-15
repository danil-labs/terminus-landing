#!/usr/bin/env node
/**
 * Compila la demo de la landing: **la interfaz real de Terminus**, con Tauri
 * simulado.
 *
 *     node scripts/demo.mjs <carpeta de harness-app>
 *
 * **No es una maqueta.** Se compila el front de `harness-app` tal cual y, antes
 * de su bundle, se carga `demo/simulador.js`, que contesta en lugar del backend
 * —la misma técnica que `scripts/mount.mjs` de allá—. Lo que se ve son los
 * componentes, los estilos y los textos de la app de verdad.
 *
 * **Nada queda sin respuesta.** Este script lee todos los `invoke<T>("…")` del
 * front y le da a cada comando la respuesta vacía que su tipo admite: una
 * lista vacía, `false`, un texto vacío. Así un comando nuevo en la app no
 * aparece en la demo como un error, y el simulador solo escribe a mano lo que
 * tiene algo que enseñar.
 *
 * **La checkout no se toca.** Se exporta `HEAD` con `git archive` a una
 * carpeta temporal y se compila ahí: la carpeta puede ser el árbol de otra
 * tarea.
 *
 * Sale en `public/demo/`, que sí entra al repositorio: el CI de la landing no
 * puede leer `harness-app`, que es privado. El commit de la app queda escrito
 * en `public/demo/VERSION`.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const landing = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = process.argv[2];
if (!app || !existsSync(join(app, "package.json")) || !existsSync(join(app, "src-tauri"))) {
  console.error("Uso: node scripts/demo.mjs <carpeta de harness-app>");
  process.exit(1);
}

const salida = join(landing, "public", "demo");
const temporal = mkdtempSync(join(tmpdir(), "terminus-demo-"));
const correr = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: ["ignore", "inherit", "inherit"] });

try {
  const commit = execFileSync("git", ["-C", app, "rev-parse", "--short", "HEAD"]).toString().trim();
  console.log(`harness-app ${commit} → ${relative(landing, salida)}/`);

  execFileSync("sh", ["-c", `git -C "${app}" archive HEAD | tar -x -C "${temporal}"`]);
  correr("pnpm", ["install", "--frozen-lockfile", "--silent"], temporal);
  correr("pnpm", ["exec", "vite", "build", "--base", "/demo/", "--outDir", salida, "--emptyOutDir"], temporal);

  writeFileSync(join(salida, "datos.js"), `window.__DEMO__ = ${JSON.stringify({
    commit,
    version: JSON.parse(readFileSync(join(temporal, "package.json"), "utf8")).version,
    comandos: tiposDeComandos(join(temporal, "src")),
    archivos: archivosDeLaLanding(),
  })};\n`);
  copyFileSync(join(landing, "demo", "simulador.js"), join(salida, "simulador.js"));

  // Los dos scripts clásicos corren antes que el módulo de la app, en orden:
  // cuando la app haga su primer `invoke`, el simulador ya está puesto.
  const indice = join(salida, "index.html");
  const html = readFileSync(indice, "utf8");
  if (!html.includes('<script type="module"')) throw new Error("index.html sin <script type=module>: cambió la salida de Vite");
  writeFileSync(
    indice,
    html.replace(
      '<script type="module"',
      '<script src="/demo/datos.js"></script>\n    <script src="/demo/simulador.js"></script>\n    <script type="module"',
    ),
  );
  writeFileSync(join(salida, "VERSION"), `${commit}\n`);
  console.log("Listo.");
} finally {
  rmSync(temporal, { recursive: true, force: true });
}

/**
 * Qué respuesta vacía admite cada comando, leída del tipo con que lo llama el
 * front. `objeto` es lo que no se puede inventar vacío: si el simulador no lo
 * contesta a mano, recibe `null`.
 */
function tiposDeComandos(src) {
  const tipos = {};
  const clase = (t) => {
    if (!t) return "nulo";
    t = t.trim();
    if (/\[\]$/.test(t) || /^\[.*\]\[\]$/.test(t)) return "lista";
    if (t === "boolean") return "bool";
    if (t === "string") return "texto";
    if (t === "number") return "numero";
    if (/^Record</.test(t)) return "registro";
    if (/\|\s*null$/.test(t) || t === "void" || t === "null" || t === "unknown") return "nulo";
    return "objeto";
  };
  for (const archivo of recorrer(src)) {
    if (![".ts", ".tsx"].includes(extname(archivo))) continue;
    const texto = readFileSync(archivo, "utf8");
    for (const m of texto.matchAll(/invoke(?:<([^;]{0,160}?)>)?\(\s*"([a-z_0-9]+)"/g)) {
      const c = clase(m[1]);
      // Si dos sitios lo llaman con tipos distintos, gana el más exigente.
      const orden = ["nulo", "texto", "numero", "bool", "registro", "lista", "objeto"];
      if (!tipos[m[2]] || orden.indexOf(c) > orden.indexOf(tipos[m[2]])) tipos[m[2]] = c;
    }
  }
  return tipos;
}

/**
 * Los archivos de esta landing, que son los que la demo enseña en su árbol:
 * el proyecto de la demo es este repositorio, y su contenido es el de verdad.
 * Solo texto, y solo lo que se lee de un vistazo.
 */
function archivosDeLaLanding() {
  const rutas = execFileSync("git", ["-C", landing, "ls-files"]).toString().trim().split("\n");
  const archivos = {};
  for (const ruta of rutas) {
    if (ruta.startsWith("public/demo/") || ruta === "package-lock.json") continue;
    const completo = join(landing, ruta);
    if (!existsSync(completo)) continue;
    const bytes = statSync(completo).size;
    const texto = [".astro", ".css", ".js", ".mjs", ".json", ".jsonc", ".md", ".yml", ".ts"].includes(extname(ruta));
    archivos[ruta] = { bytes, texto: texto && bytes < 24_000 ? readFileSync(completo, "utf8") : null };
  }
  return archivos;
}

function* recorrer(carpeta) {
  for (const nombre of readdirSync(carpeta)) {
    const ruta = join(carpeta, nombre);
    if (statSync(ruta).isDirectory()) yield* recorrer(ruta);
    else yield ruta;
  }
}
