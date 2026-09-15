/*
 * El backend de Terminus, simulado, para la demo de la landing.
 *
 * La app llama a Tauri por `window.__TAURI_INTERNALS__.invoke`; aquí se contesta
 * en su lugar, igual que `scripts/mount.mjs` de harness-app. Todo lo que se ve
 * lo pinta la app real: esto solo le da datos.
 *
 * - **Nada queda sin respuesta.** `datos.js` (lo escribe `scripts/demo.mjs`)
 *   trae, por comando, la respuesta vacía que admite su tipo. Lo de aquí es lo
 *   que tiene algo que enseñar.
 * - **El proyecto es este repositorio.** El árbol de la tarea enseña los
 *   archivos reales de la landing, con su contenido.
 * - **El agente dice que es una demo.** Al escribirle, corre un turno guionado
 *   —lee, crea un componente, edita la página, compila— y lo primero que
 *   contesta es que la respuesta está simulada.
 */
(() => {
  const D = window.__DEMO__ || { comandos: {}, archivos: {}, version: "" };
  const WS = "danil";
  const ahora = Date.now();
  const hace = (min) => ahora - min * 60_000;
  const RAIZ = "/Users/demo/Proyectos";

  /* ------------------------------------------------------------ agentes */

  const AGENTES = [
    { id: "claude", label: "Claude Code", limits: true, inferencia: "con_cuenta" },
    { id: "codex", label: "Codex", limits: true, inferencia: "con_cuenta" },
    { id: "grok", label: "Grok", limits: false, inferencia: "con_cuenta" },
    { id: "antigravity", label: "Antigravity", limits: false, inferencia: "con_cuenta" },
    { id: "opencode-zen", label: "OpenCode", limits: false, inferencia: "con_cuenta" },
    { id: "opencode-local", label: "Locales", limits: false, inferencia: "en_la_maquina", sin_cuenta: true },
  ].map((a) => ({ available: true, driver: true, sin_cuenta: false, api_key: null, ...a }));
  const etiqueta = (id) => AGENTES.find((a) => a.id === id)?.label ?? "El agente";

  // Conectadas: las dos de la tarea. El resto se ve en Configuración con su
  // botón de conectar, como en una instalación nueva.
  const CONECTADAS = {
    claude: [["últimas 5 horas", 22, 2.2], ["esta semana", 41, 76]],
    codex: [["últimas 5 horas", 36, 3.5], ["esta semana", 18, 101]],
  };
  // «efforts» son cadenas que la app pinta tal cual, sin catálogo detrás
  // (`chat.effort.title`: «Cuánto piensa antes de responder»); van en
  // español porque aquí no hay ningún proveedor real publicándolas.
  const MODELOS = {
    claude: [
      { id: "claude-opus-5", label: "Opus 5", note: null, efforts: ["bajo", "medio", "alto"], default_effort: "medio", gratis: null },
      { id: "claude-sonnet-5", label: "Sonnet 5", note: null, efforts: ["bajo", "medio", "alto"], default_effort: "medio", gratis: null },
    ],
    codex: [{ id: "gpt-5.6", label: "GPT-5.6", note: null, efforts: ["bajo", "medio", "alto"], default_effort: "medio", gratis: null }],
  };
  // Los tres modos reales de `Modo::CICLO` (`runtime/agents/types.rs`), con
  // sus ids y frases exactas. «Acepta ediciones» es el que trae la app de
  // fábrica (`Modo::OMISION`), y así arranca aquí también.
  const MODOS_DE_PERMISO = [
    { id: "manual", label: { clave: "agents.mode.manual" }, falta: null, por_omision: false },
    { id: "ediciones", label: { clave: "agents.mode.edits" }, falta: null, por_omision: true },
    { id: "auto", label: { clave: "agents.mode.auto" }, falta: null, por_omision: false },
  ];

  /* ---------------------------------------------------- espacio y proyectos */

  const ESPACIO = {
    // Con `context_root` puesto, la app no ofrece «Conectar / Seleccionar
    // carpeta»: ese aviso es del workspace («Contexto principal» en
    // Configuración → General), no de cada proyecto, y solo aparece cuando de
    // verdad falta (`app/App.tsx`, `SelectorDeProyecto`).
    id: WS, name: "Danil", context_root: `${RAIZ}/danil-workspace`, lengua: "es", lengua_de_salida: null,
    worktrees_root: null, provider: null, remote: null, memoria: { tipo: "local" },
    created_at: hace(60 * 24 * 30), sessions: 2,
  };
  const ARRANQUE = { workspaces: [ESPACIO], active: WS, migrations: [] };

  const proyecto = (id, name, kind, cloud = null) => ({
    id, name, node: null, sources: [], portfolio: null,
    working_directory: `${RAIZ}/${id}`, work_tree: null,
    created_at: hace(60 * 24 * 20), updated_at: hace(5), sessions: 1, kind, cloud,
  });
  const PROYECTOS = [
    proyecto("terminus-landing", "terminus-landing", "git"),
    proyecto("danil-workspace", "danil-workspace", "git"),
    // Carpeta de documentos, sin git: donde viven los estados «borrador» y
    // «guardado» (`GitStatus.kn`, ver `taskGit.ts`).
    proyecto("documentos-clientes", "Documentos de clientes", "folder"),
    // Una carpeta en la nube: mismo tipo «folder», con su proveedor. El icono
    // de nube lo decide `WorkdirIcon` a partir de este campo.
    proyecto("marketing-drive", "Campañas (Drive)", "folder", "google_drive"),
  ];
  const CON_ARBOL = "terminus-landing";

  const SESIONES = {
    "terminus-landing": [
      { id: "landing", title: "Simplificar la landing", agent: "claude", model: "claude-opus-5", updated_at: hace(4) },
      // Un worktree sin rama: el agente todavía no hizo el primer commit que
      // le da nombre (`ARCHITECTURE.md` § 1 — «la app no crea ninguna rama»).
      { id: "sin-rama", title: "Explorar otra idea de hero", agent: "antigravity", model: "gemini-3-pro", updated_at: hace(210) },
      { id: "pr-abierto", title: "Agregar aviso de SmartScreen", agent: "grok", model: "grok-5", updated_at: hace(1400) },
      { id: "pr-mergeado", title: "Corregir el aria-label del árbol", agent: "opencode-zen", model: "qwen3-coder", updated_at: hace(4200) },
    ],
    "danil-workspace": [
      { id: "docs", title: "Qué es Terminus hoy", agent: "codex", model: "gpt-5.6", updated_at: hace(90) },
    ],
    "documentos-clientes": [
      { id: "borrador-cliente", title: "Política de reembolsos", agent: "claude", model: "claude-sonnet-5", updated_at: hace(30) },
      { id: "guardado-cliente", title: "Preguntas frecuentes de soporte", agent: "codex", model: "gpt-5.6", updated_at: hace(2600) },
    ],
    "marketing-drive": [
      { id: "campaña-q4", title: "Resumen de la campaña de Q4", agent: "codex", model: "gpt-5.6", updated_at: hace(50) },
    ],
  };
  const TURNOS = {
    landing: [
      { role: "user", id: "u1", at: hace(12), text: "Revisa la landing de terminus.danil.ai contra lo que hace la app hoy. Quiero algo mucho más simple." },
      {
        role: "agent", id: "a1", at: hace(4), duration_ms: 468_000, model: "claude-opus-5",
        tools: [
          { name: "Read", target: "src/pages/index.astro", ok: true },
          { name: "Read", target: "src/styles/global.css", ok: true },
          { name: "Grep", target: "onboarding", ok: true },
          { name: "Write", target: "src/pages/index.astro", ok: true },
        ],
        text: "La página prometía cosas que la app ya no hace y le dedicaba secciones a detalle técnico.\n\nLa dejé en **una idea, tres pasos y la descarga**, con los textos del propio onboarding:\n\n1. Instalas y se prepara sola.\n2. Conectas tus cuentas de IA.\n3. Le das una tarea sobre tu carpeta.",
      },
    ],
    "sin-rama": [
      { role: "user", id: "u1", at: hace(215), text: "Antes de tocar nada, prueba una versión del hero con el mockup a la izquierda." },
      { role: "agent", id: "a1", at: hace(210), duration_ms: 52_000, model: "gemini-3-pro", tools: [{ name: "Write", target: "src/pages/index.astro", ok: true }], text: "Probé esa versión en esta copia. No convenció: el título perdía peso. Puedes seguir aquí o descartarla." },
    ],
    "pr-abierto": [
      { role: "user", id: "u1", at: hace(1410), text: "Falta el aviso de SmartScreen junto al botón de Windows." },
      { role: "agent", id: "a1", at: hace(1400), duration_ms: 88_000, model: "grok-5", tools: [{ name: "Edit", target: "src/pages/index.astro", ok: true }], text: "Agregado, con el mismo texto que la sección de Estado. Dejé la rama lista y el pull request abierto." },
    ],
    "pr-mergeado": [
      { role: "user", id: "u1", at: hace(4210), text: "El árbol de trabajo no dice qué es cuando lo lee un lector de pantalla." },
      { role: "agent", id: "a1", at: hace(4200), duration_ms: 61_000, model: "qwen3-coder", tools: [{ name: "Edit", target: "src/components/Demo.astro", ok: true }], text: "Le puse `aria-label` al iframe. Ya se fusionó a `main`." },
    ],
    docs: [
      { role: "user", id: "u1", at: hace(95), text: "¿Qué dice la documentación que es Terminus?" },
      {
        role: "agent", id: "a1", at: hace(90), duration_ms: 41_000, model: "gpt-5.6",
        tools: [{ name: "Read", target: "docs/ARCHITECTURE.md", ok: true }],
        text: "Una app de escritorio para trabajar con agentes de terminal sobre el material de una organización. Corre en tu computadora, con la suscripción de cada persona, y no usa ningún servicio de Danil.",
      },
    ],
    "borrador-cliente": [
      { role: "user", id: "u1", at: hace(35), text: "Escribe la política de reembolsos para el plan Starter." },
      { role: "agent", id: "a1", at: hace(30), duration_ms: 71_000, model: "claude-sonnet-5", tools: [{ name: "Write", target: "politica-reembolsos.md", ok: true }], text: "Aquí tienes un primer borrador. Todavía no lo guardé en tu carpeta —revísalo y dime si falta algo." },
    ],
    "guardado-cliente": [
      { role: "user", id: "u1", at: hace(2610), text: "Junta las preguntas que más hace soporte sobre facturación." },
      { role: "agent", id: "a1", at: hace(2600), duration_ms: 54_000, model: "gpt-5.6", tools: [{ name: "Write", target: "preguntas-frecuentes.md", ok: true }], text: "Listo, y ya lo guardé en tu carpeta de documentos." },
    ],
    "campaña-q4": [
      { role: "user", id: "u1", at: hace(55), text: "Resume qué archivos tiene la carpeta de la campaña de Q4." },
      { role: "agent", id: "a1", at: hace(50), duration_ms: 33_000, model: "gpt-5.6", tools: [{ name: "Read", target: "briefing-q4.docx", ok: true }], text: "Es una demo: la respuesta está simulada. En Terminus esto lee de verdad los archivos de tu Drive, sin copiarlos a ningún servidor de Danil." },
    ],
  };
  const ARTEFACTOS = {}; // sesión → { rel: texto }

  const filas = (p) => (p ? SESIONES[p] ?? [] : Object.values(SESIONES).flat());
  const sesion = (id) => Object.values(SESIONES).flat().find((s) => s.id === id);
  const proyectoDe = (id) => Object.keys(SESIONES).find((p) => SESIONES[p].some((s) => s.id === id));
  const fila = (s, p) => {
    const turnos = TURNOS[s.id] ?? [];
    const ultimo = [...turnos].reverse().find((t) => t.role === "agent");
    return {
      id: s.id, title: s.title, agent: s.agent, model: s.model, refs: [], project: p,
      created_at: turnos[0]?.at ?? s.updated_at, updated_at: s.updated_at, turns: turnos.length, parent: null, esperando: false,
      last_message: ultimo ? ultimo.text.replace(/[*`#]/g, "").split("\n")[0].slice(0, 90) : "",
    };
  };

  /* ------------------------------------------------ el árbol de la tarea */

  // Lo que el turno simulado cambió, por sesión: archivos nuevos y editados.
  const NUEVOS = {};
  const EDITADOS = {};
  const original = (ruta) => D.archivos[ruta]?.texto ?? null;
  const contenido = (s, ruta) => NUEVOS[s]?.[ruta] ?? EDITADOS[s]?.[ruta] ?? original(ruta);
  const rutas = (s) => [...new Set([...Object.keys(D.archivos), ...Object.keys(NUEVOS[s] ?? {})])].sort();
  const cambios = (s) => [
    ...Object.entries(NUEVOS[s] ?? {}).map(([path, t]) => ({ path, added: t.split("\n").length, removed: 0, status: "A" })),
    ...Object.entries(EDITADOS[s] ?? {}).map(([path, t]) => {
      const d = lineas(original(path) ?? "", t);
      return { path, added: d.filter((l) => l[0] === "+").length, removed: d.filter((l) => l[0] === "-").length, status: "M" };
    }),
  ];
  const suma = (s, k) => cambios(s).reduce((n, c) => n + c[k], 0);

  // Un diff de verdad, por líneas (LCS). Los archivos de la demo son chicos.
  function lineas(a, b) {
    const x = a.split("\n"), y = b.split("\n");
    const m = x.length, n = y.length;
    const t = Array.from({ length: m + 1 }, () => new Uint16Array(n + 1));
    for (let i = m - 1; i >= 0; i--)
      for (let j = n - 1; j >= 0; j--)
        t[i][j] = x[i] === y[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
    const out = [];
    let i = 0, j = 0;
    while (i < m && j < n) {
      if (x[i] === y[j]) { out.push(" " + x[i]); i++; j++; }
      else if (t[i + 1][j] >= t[i][j + 1]) out.push("-" + x[i++]);
      else out.push("+" + y[j++]);
    }
    while (i < m) out.push("-" + x[i++]);
    while (j < n) out.push("+" + y[j++]);
    return out;
  }
  function parche(ruta, antes, despues) {
    if (antes === null) {
      const l = despues.split("\n");
      return `diff --git a/${ruta} b/${ruta}\nnew file mode 100644\n--- /dev/null\n+++ b/${ruta}\n@@ -0,0 +1,${l.length} @@\n${l.map((x) => "+" + x).join("\n")}\n`;
    }
    const d = lineas(antes, despues);
    const cuerpo = [];
    let ia = 1, ib = 1, k = 0;
    while (k < d.length) {
      if (d[k][0] === " ") { ia++; ib++; k++; continue; }
      const ini = Math.max(0, k - 3);
      let fin = k;
      while (fin < d.length && (d[fin][0] !== " " || d.slice(fin, fin + 7).some((l) => l[0] !== " "))) fin++;
      fin = Math.min(d.length, fin + 3);
      const trozo = d.slice(ini, fin);
      const a0 = ia - (k - ini), b0 = ib - (k - ini);
      cuerpo.push(`@@ -${a0},${trozo.filter((l) => l[0] !== "+").length} +${b0},${trozo.filter((l) => l[0] !== "-").length} @@`, ...trozo);
      for (const l of d.slice(k, fin)) { if (l[0] !== "+") ia++; if (l[0] !== "-") ib++; }
      k = fin;
    }
    return `diff --git a/${ruta} b/${ruta}\n--- a/${ruta}\n+++ b/${ruta}\n${cuerpo.join("\n")}\n`;
  }
  const parcheDe = (s, ruta) =>
    cambios(s)
      .filter((c) => !ruta || c.path === ruta)
      .map((c) => parche(c.path, c.status === "A" ? null : original(c.path) ?? "", contenido(s, c.path) ?? ""))
      .join("");

  // El estado de git de cada tarea, compartido por `arbolDe` y por
  // `list_session_git`: para el árbol de trabajo la rama tiene que ser la
  // misma que se lee en el resto de la app, o «sin-rama» abriría su columna
  // enseñando una rama que no tiene.
  const GIT = {
    landing: { kind: "branch", kn: null, branch: "feat/landing-simple", alias: "mizar-260915", head: () => D.commit || "4293fc5", repositorio: "terminus-landing", pull: null },
    "sin-rama": { kind: "detached", kn: null, branch: null, alias: "vega-260908", head: () => "a1c02ef", repositorio: "terminus-landing", pull: null },
    "pr-abierto": { kind: "branch", kn: null, branch: "fix/smartscreen-aviso", alias: "rigel-260901", head: () => "7f0d914", repositorio: "terminus-landing", pull: { number: 21, state: "open", head_sha: "7f0d914", checks: "passed", review: "pending" } },
    "pr-mergeado": { kind: "branch", kn: null, branch: "fix/aria-arbol", alias: "denebola-260825", head: () => "3bb27a0", repositorio: "terminus-landing", pull: { number: 14, state: "merged", head_sha: "3bb27a0" } },
    docs: { kind: "branch", kn: null, branch: "main", alias: "phecda-260910", head: () => "e5a0c2b", repositorio: "danil-workspace", pull: null },
    "borrador-cliente": { kind: "kn", kn: "draft", branch: null, alias: null, head: () => null, repositorio: "documentos-clientes", pull: null },
    "guardado-cliente": { kind: "kn", kn: "saved", branch: null, alias: null, head: () => null, repositorio: "documentos-clientes", pull: null },
    "campaña-q4": { kind: "none", kn: null, branch: null, alias: null, head: () => null, repositorio: "marketing-drive", pull: null },
  };

  const arbolDe = (s) => {
    const g = GIT[s];
    if (!g || proyectoDe(s) !== CON_ARBOL) return [];
    return [{
      key: "work", name: CON_ARBOL, path: `${RAIZ}/${CON_ARBOL}`, origin: "declarada",
      kind: g.kind === "detached" ? "git" : "git", cloud: null, source: null,
      remote: "https://github.com/danil-labs/terminus-landing",
      branch: g.branch ?? "", missing: false, dirty_before: 0, changed: cambios(s).length, base_drift: null,
    }];
  };
  const verArchivo = (s, ruta) => {
    const texto = contenido(s, ruta);
    const bytes = texto?.length ?? D.archivos[ruta]?.bytes ?? 0;
    return texto === null
      ? { kind: "binary", text: "", data_url: null, bytes, truncated: false }
      : { kind: "text", text: texto, data_url: null, bytes, truncated: false };
  };

  /* ------------------------------------------------ eventos y turnos vivos */

  const callbacks = new Map();
  const oyentes = new Map(); // evento → ids
  const emitir = (event, payload) => {
    for (const id of oyentes.get(event) ?? []) callbacks.get(id)?.({ event, id, payload });
  };
  const canales = new Map(); // sesión → canal del árbol
  const avisarArbol = (s) => { try { canales.get(s)?.onmessage?.({}); } catch {} };

  const VIVAS = new Map(); // sesión → { desde, relojes }

  const COMPONENTE = `---
/** Las preguntas que más llegan, con su respuesta corta. */
const PREGUNTAS = [
  { p: "¿Necesito saber programar?", r: "No. Le escribes la tarea como se la dirías a alguien de tu equipo." },
  { p: "¿Qué cuentas de IA puedo usar?", r: "Claude Code, Codex, Gemini, Grok, OpenCode o modelos locales." },
  { p: "¿Mis archivos pasan por Danil?", r: "No. Van de tu computadora a tu proveedor de IA." },
];
---

<section class="envoltura preguntas">
  <h2>Preguntas frecuentes</h2>
  <dl>
    {PREGUNTAS.map(({ p, r }) => (
      <div class="pregunta">
        <dt>{p}</dt>
        <dd>{r}</dd>
      </div>
    ))}
  </dl>
</section>
`;
  const conPreguntas = (texto) =>
    texto
      .replace(/(import Demo from "\.\.\/components\/Demo\.astro";\n)/, `$1import Preguntas from "../components/Preguntas.astro";\n`)
      .replace(/(\n\s*<section class="envoltura cierre">)/, `\n      <Preguntas />\n$1`);

  function correrTurno(s, agente, modelo) {
    const p = proyectoDe(s);
    const conArbol = p === CON_ARBOL;
    const pagina = "src/pages/index.astro";
    const antes = original(pagina) ?? "";
    const RESUMEN = conArbol
      ? "# Qué cambió\n\n- Nuevo componente `src/components/Preguntas.astro`, con tres preguntas.\n- La página lo muestra antes del cierre.\n- `npm run build` pasa.\n"
      : "# Respuesta\n\nEsto es una demo: en la app real, el agente lee tus documentos y escribe aquí lo que encontró.\n";
    const nombre = etiqueta(agente);
    const texto = conArbol
      ? `Esto es una demo: la respuesta está simulada. En Terminus, ${nombre} trabaja de verdad sobre tu carpeta, con tu cuenta.\n\nPara que veas cómo se ve, agregué una sección de **preguntas frecuentes**:\n\n- Creé \`src/components/Preguntas.astro\`.\n- La puse en \`src/pages/index.astro\`, antes del cierre.\n- Corrí \`npm run build\` y pasa.\n\nLos cambios están en el árbol de trabajo, y el resumen en \`resumen.md\`.`
      : `Esto es una demo: la respuesta está simulada. En Terminus, ${nombre} lee de verdad el material de tu proyecto, con tu cuenta, y te deja lo que encuentra como archivo. Te dejé uno de ejemplo en \`resumen.md\`.`;

    const pasos = conArbol
      ? [
          ["Read", pagina, null],
          ["Read", "src/styles/global.css", null],
          ["Write", "src/components/Preguntas.astro", { kind: "edit", before: null, after: COMPONENTE }, () => { (NUEVOS[s] ??= {})["src/components/Preguntas.astro"] = COMPONENTE; }],
          ["Edit", pagina, { kind: "edit", before: antes, after: conPreguntas(antes) }, () => { (EDITADOS[s] ??= {})[pagina] = conPreguntas(antes); }],
          ["Bash", "npm run build", { kind: "output", text: "> astro build\n\n▶ src/pages/index.astro\n  └─ /index.html (+402ms)\n✓ Completed in 406ms.\n1 page(s) built in 731ms\nComplete!", exit_code: 0, truncated: false }],
          ["Write", "resumen.md", { kind: "edit", before: null, after: RESUMEN }, () => { (ARTEFACTOS[s] ??= {})["resumen.md"] = RESUMEN; }],
        ]
      : [
          ["Read", "README.md", null],
          ["Write", "resumen.md", { kind: "edit", before: null, after: RESUMEN }, () => { (ARTEFACTOS[s] ??= {})["resumen.md"] = RESUMEN; }],
        ];

    const base = { workspace: WS, session: s, meta: null, ok: null, request_id: null };
    const viva = { desde: Date.now(), relojes: [] };
    VIVAS.set(s, viva);
    let t = 350;
    const luego = (ms, fn) => { t += ms; viva.relojes.push(setTimeout(fn, t)); };

    luego(0, () => emitir("chat", { ...base, kind: "started", text: "" }));
    pasos.forEach(([herramienta, objetivo, detalle, efecto], i) => {
      const id = `demo-${s}-${Date.now()}-${i}`;
      luego(500, () => emitir("chat", { ...base, kind: "tool", id, text: herramienta, target: objetivo }));
      luego(herramienta === "Bash" ? 1600 : 900, () => {
        efecto?.();
        emitir("chat", { ...base, kind: "tool_done", id, text: herramienta, target: objetivo, ok: true, ...(detalle ? { detail: detalle } : {}) });
        if (efecto) avisarArbol(s);
      });
    });
    // El texto llega en trozos, como del stream de un CLI.
    const trozos = texto.match(/\S+\s*/g) ?? [];
    trozos.forEach((trozo) => luego(28, () => emitir("chat", { ...base, kind: "delta", text: trozo })));
    luego(300, () => {
      const s0 = sesion(s);
      (TURNOS[s] ??= []).push({
        role: "agent", id: `a-${Date.now()}`, at: Date.now(), duration_ms: Date.now() - viva.desde, model: modelo,
        tools: pasos.map(([name, target]) => ({ name, target, ok: true })),
        text: texto,
        artifacts: Object.entries(ARTEFACTOS[s] ?? {}).map(([rel, x]) => ({ rel, bytes: x.length, revision: false })),
      });
      if (s0) s0.updated_at = Date.now();
      VIVAS.delete(s);
      emitir("chat", { ...base, kind: "done", text: "", ok: true });
      avisarArbol(s);
    });
  }

  function enviar(a = {}) {
    const p = a.project ?? CON_ARBOL;
    let s = a.session && sesion(a.session) ? a.session : null;
    const agente = a.agent ?? "claude";
    const modelo = a.model ?? MODELOS[agente]?.[0]?.id ?? null;
    if (!s) {
      s = `demo-${Date.now()}`;
      const titulo = String(a.prompt ?? "Nueva tarea").split("\n")[0].slice(0, 48);
      (SESIONES[p] ??= []).unshift({ id: s, title: titulo, agent: agente, model: modelo, updated_at: Date.now() });
    }
    (TURNOS[s] ??= []).push({ role: "user", id: `u-${Date.now()}`, at: Date.now(), text: String(a.prompt ?? "") });
    correrTurno(s, sesion(s)?.agent ?? agente, modelo);
    return s;
  }

  /* ----------------------------------------------------------- respuestas */

  // Estado del entorno cruza los dos por id: el requisito dice si está, la
  // dependencia qué versión y dónde. Es lo que la preparación deja instalado.
  const HERRAMIENTAS = [
    ["git", "Git", "2.51.0", "tool", 48_000_000],
    ["node", "Node.js", "22.20.0", "tool", 96_000_000],
    ["pnpm", "pnpm", "10.18.0", "tool", 18_000_000],
    ["gh", "GitHub CLI", "2.81.0", "github", 42_000_000],
    ["claude", "Claude Code", "2.4.1", "agent", 180_000_000],
    ["codex", "Codex", "0.61.0", "agent", 140_000_000],
  ];
  const R = {
    check_environment: {
      ready: true, blocked: false, reason: null, build: "demo", bootstrap: [], firstRun: false,
      essential: ["git", "node"], runtimeVersions: {},
      items: HERRAMIENTAS.map(([id, label, , manager, bytes]) => ({
        id, label, ok: true, required: id === "git" || id === "node", detail: "", remedy: null,
        source: "instalado por la app", bytes, installable: false, redundant: false, manager,
      })),
    },
    list_dependencies: HERRAMIENTAS.map(([id, label, version, , bytes]) => ({
      id, label, version, location: `/Users/demo/Library/Application Support/ai.danil.terminus/entorno/${id}`, bytes,
    })),
    list_agents: AGENTES,
    list_workspaces: ARRANQUE,
    workspaces_startup: ARRANQUE,
    list_projects: PROYECTOS,
    // **Solo las del proyecto que se pregunta.** Las filas no dicen de qué
    // proyecto son: la app las agrupa por la pregunta, y `""` son las tareas
    // sueltas. Contestar todas a `""` las volvía sueltas, la pestaña se quedaba
    // sin proyecto y el árbol de trabajo no se montaba.
    list_sessions: (a) => (SESIONES[a?.project] ?? []).map((s) => fila(s, a.project)),
    load_session: (a) => {
      const s = sesion(a?.id ?? a?.session) ?? filas()[0];
      return { id: s.id, agent: s.agent, sources: [], model: s.model, effort: null, permission_mode: null, turns: TURNOS[s.id] ?? [] };
    },
    send_message: enviar,
    stop_turn: (a) => {
      const v = VIVAS.get(a?.session);
      if (v) { v.relojes.forEach(clearTimeout); VIVAS.delete(a.session); emitir("chat", { workspace: WS, session: a.session, kind: "done", text: "", meta: null, ok: null, request_id: null }); }
      return null;
    },
    list_active_turns: () => [...VIVAS.keys()],
    list_live_turns: () => [...VIVAS.entries()].map(([session, v]) => ({ session, workspace: WS, project: proyectoDe(session), started_at: v.desde })),
    session_folder: (a) => `/Users/demo/.terminus/tareas/${a?.session ?? a?.id ?? "tarea"}`,
    list_models: (a) => ({ agent: a?.agent ?? "claude", models: MODELOS[a?.agent ?? "claude"] ?? [], fallback: false }),
    list_surfaces: AGENTES.filter((a) => a.id !== "opencode-local").map((a) => ({
      id: a.id, agent: a.id, label: a.label, catalogo: "todo",
      usable: Boolean(CONECTADAS[a.id]), marca: CONECTADAS[a.id] ? null : "sin conectar",
      porque: CONECTADAS[a.id] ? null : "Falta conectar la cuenta.",
    })),
    // Control de Fuentes: GitHub conectado a la organización, Bitbucket con su
    // formulario. Los textos son claves del catálogo de la app
    // (`providers.json`), que es lo que manda `delivery/providers/*.rs`.
    list_providers: [
      {
        id: "github", name: "GitHub", select_area: true, setup_url: null, fields: [], browser_login: true,
        token_label: { clave: "providers.github.token_label" }, token_help: { clave: "providers.github.token_help" },
        token_url: "https://github.com/settings/tokens", area_label: { clave: "providers.github.area_label" },
        areas_label: { clave: "providers.github.areas_label" }, area_help: { clave: "providers.github.area_help" },
        login_help: { clave: "providers.github.login_help.browser" }, unverified: null,
        connected: {
          selected_area: { key: "danil-labs", installation_id: 1 }, selected_areas: [{ key: "danil-labs", installation_id: 1 }],
          data: {}, workspace: "danil-labs", identity: { user: "danil-labs", name: "Danil" }, connected_at: hace(60 * 24 * 20),
        },
      },
      {
        id: "bitbucket", name: "Bitbucket", select_area: false, setup_url: null, browser_login: false,
        fields: [{
          id: "space", required: true, label: { clave: "providers.bitbucket.field.space.label" },
          help: { clave: "providers.bitbucket.field.space.help" }, falta: { clave: "providers.bitbucket.field.space.missing" },
        }],
        token_label: { clave: "providers.bitbucket.token_label" }, token_help: { clave: "providers.bitbucket.token_help" },
        token_url: "https://bitbucket.org/account/settings/api-tokens/", area_label: { clave: "providers.bitbucket.area_label" },
        areas_label: { clave: "providers.bitbucket.areas_label" }, area_help: { clave: "providers.bitbucket.area_help" },
        login_help: { clave: "providers.bitbucket.login_help" }, connected: null, unverified: null,
      },
    ],
    // La pantalla vuelve a verificar cada proveedor al abrirse, y espera el
    // `Provider` entero de vuelta. Se busca por cualquier argumento que nombre
    // uno: el comando manda el id con el nombre que le toca.
    provider_areas: [{ key: "danil-labs", name: "danil-labs" }],
    provider_available_areas: [{ key: "danil-labs", name: "danil-labs" }],
    check_provider: (a) => proveedorDe(a),
    connect_provider: (a) => proveedorDe(a),
    finish_provider_setup: (a) => proveedorDe(a),
    finish_browser_login: (a) => proveedorDe(a),
    select_provider_area: (a) => proveedorDe(a),
    list_accounts: (a) => ({
      agent: a?.agent, env_var: "", shared_credential: null, secret_note: null,
      active: CONECTADAS[a?.agent] ? `cuenta-${a.agent}` : null,
      accounts: CONECTADAS[a?.agent] ? [{ id: `cuenta-${a.agent}`, label: "Cuenta 1", created_at: hace(60 * 24 * 20), identity: null, authenticated_at: hace(60 * 24 * 20) }] : [],
    }),
    account_limits: (a) => ({
      mode: "read", plan: null, fetched_at: Date.now(),
      windows: (CONECTADAS[a?.agent] ?? []).map(([label, used_pct, horas]) => ({ label, used_pct, resets_at: ahora + horas * 3_600_000 })),
    }),
    account_status: (a) => ({ id: a?.id, authenticated: true, detail: "" }),
    list_local_models: [],
    consent_text: [[], 0],
    list_known_mcp: [
      { id: "figma", grupo: "figma", clave: "figma", name: "Figma", via: { clave: "mcp.known.figma.via" }, requiere: { clave: "mcp.known.figma.requires" }, despues: { clave: "mcp.known.figma.after" }, conectado: false },
      { id: "atlassian", grupo: "atlassian", clave: "atlassian", name: "Atlassian", via: null, requiere: { clave: "mcp.known.atlassian.requires" }, despues: { clave: "mcp.known.atlassian.after" }, conectado: false },
    ],
    list_mcp_agents: AGENTES.filter((a) => CONECTADAS[a.id]).map((a) => ({ id: a.id, label: a.label, recibe: true, instalado: true })),
    list_integrations: { workspace: WS, plugins: [{ id: "libreoffice", installed: true, enabled: true, version: "25.8", bytes: 312_000_000, supported: true }] },
    list_skill_sources: { fuentes: [], rotas: [] },
    list_ports: { tareas: [], externos: [], aviso: null },
    agentsview_status: { installed: false, enabled: false },
    // Siete formas de estar a medio camino: con rama y sin rama (`sin-rama`,
    // todavía no hay nada que nombrar), un pull request abierto y otro ya
    // fusionado, y las dos carpetas de documentos con su `kn` — «borrador»
    // antes de la primera vez que se guarda, «guardado» después.
    list_session_git: () => Object.fromEntries(
      Object.entries(GIT).map(([s, g]) => [s, {
        kind: g.kind, kn: g.kn, branch: g.branch, alias: g.alias, head: g.head(),
        repository: g.repositorio, shared_with: null, pull: g.pull, pull_known: g.kind !== "none" && g.kind !== "kn", checked_at: ahora, stale: false,
      }]),
    ),
    kn_pending: { files: [], folder_updated: false },
    kn_cloud_state: (a) => ({ workspace: WS, project: a?.project ?? "", state: "idle", fetched: 0, failed: 0, remaining: 0, bytes_fetched: 0, bytes_remaining: 0, failure: null }),
    get_profile: { name: "" },
    get_project_directory: RAIZ,
    task_history: (a) => ({
      history: { archived: false, events: [], recovery: null }, branch: "feat/landing-simple", alias: "mizar-260915",
      path: `${RAIZ}/${proyectoDe(a?.session ?? a?.id) ?? CON_ARBOL}`, available: true, owned: true, restorable: false, recreatable: false, incomplete: false,
    }),
    list_storage: { tareas: [], compartido: [], sueltos: [], recuperable: 0, bytes: 734_003_200, medido_en: ahora, aviso: null },
    list_mentions: { fuentes: [], truncado: false },
    // Cada tarea que existe, para probar «@»: con rama, sin rama todavía
    // (`sin-rama`), con un pull request abierto y otro ya fusionado, y dos
    // carpetas de documentos (borrador y guardado). `alias` es el nombre de
    // astro del worktree; `branch` vacío es justo lo que se ve antes del
    // primer commit que le da nombre.
    list_task_mentions: [
      { target: { kind: "task", projectId: "terminus-landing", sessionId: "landing" }, title: "Simplificar la landing", projectName: "terminus-landing", alias: "mizar-260915", branch: "feat/landing-simple", available: true, archived: false, updatedAt: hace(4) },
      { target: { kind: "task", projectId: "terminus-landing", sessionId: "sin-rama" }, title: "Explorar otra idea de hero", projectName: "terminus-landing", alias: "vega-260908", branch: "", available: true, archived: false, updatedAt: hace(210) },
      { target: { kind: "task", projectId: "terminus-landing", sessionId: "pr-abierto" }, title: "Agregar aviso de SmartScreen", projectName: "terminus-landing", alias: "rigel-260901", branch: "fix/smartscreen-aviso", available: true, archived: false, updatedAt: hace(1400) },
      { target: { kind: "task", projectId: "terminus-landing", sessionId: "pr-mergeado" }, title: "Corregir el aria-label del árbol", projectName: "terminus-landing", alias: "denebola-260825", branch: "fix/aria-arbol", available: false, archived: false, updatedAt: hace(4200) },
      { target: { kind: "task", projectId: "danil-workspace", sessionId: "docs" }, title: "Qué es Terminus hoy", projectName: "danil-workspace", alias: "phecda-260910", branch: "", available: true, archived: false, updatedAt: hace(90) },
      { target: { kind: "task", projectId: "documentos-clientes", sessionId: "borrador-cliente" }, title: "Política de reembolsos", projectName: "Documentos de clientes", alias: "", branch: "", available: true, archived: false, updatedAt: hace(30) },
      { target: { kind: "task", projectId: "documentos-clientes", sessionId: "guardado-cliente" }, title: "Preguntas frecuentes de soporte", projectName: "Documentos de clientes", alias: "", branch: "", available: true, archived: false, updatedAt: hace(2600) },
      { target: { kind: "task", projectId: "marketing-drive", sessionId: "campaña-q4" }, title: "Resumen de la campaña de Q4", projectName: "Campañas (Drive)", alias: "", branch: "", available: true, archived: false, updatedAt: hace(50) },
    ],
    // Los comandos «/», para probar el otro disparador. Nombres inventados
    // —no hay skills reales instaladas en la demo— pero con la forma exacta
    // que usa la app: nombre y una línea de qué hacen.
    list_commands: (a) => (a?.agent === "codex" ? [] : [
      { name: "resumen", description: "Resume la conversación en un párrafo." },
      { name: "revisar-cambios", description: "Revisa el árbol de trabajo antes de guardarlo." },
      { name: "documentar", description: "Escribe qué cambió, en una página." },
    ]),
    list_permission_modes: MODOS_DE_PERMISO,
    // Una ventana de memoria por sesión: cabe menos en las tareas más largas.
    // `context_used` es lo que reportó el último turno; sin ese dato el
    // agente aparece «sin medir», que es otro estado que vale la pena ver.
    session_usage: (a) => {
      const TABLA = {
        landing: [88_000, 200_000], "sin-rama": [21_000, 1_000_000], "pr-abierto": [140_000, 200_000],
        "pr-mergeado": [9_000, 200_000], docs: [26_000, 128_000],
        "borrador-cliente": [12_000, 200_000], "guardado-cliente": [null, 200_000], "campaña-q4": [31_000, 128_000],
      };
      const [context_used, context_limit] = TABLA[a?.session] ?? [null, null];
      if (context_limit === null) return { records: [] };
      return { records: [{ schema: 1, at: ahora, workspace: WS, agent: sesion(a.session)?.agent ?? "claude", account: null, model: sesion(a.session)?.model ?? null, project: proyectoDe(a.session) ?? "", session: a.session, turn: (TURNOS[a.session] ?? []).length, tokens: { input_uncached: 0, cache_read: 0, cache_write: 0, output: 0, reasoning: 0 }, cost_usd: null, context_used, context_limit, context_source: null, raw: null }] };
    },
    artifact_history: { current: null, versions: [] },

    list_task_trees: (a) => arbolDe(a?.session),
    watch_task_tree: (a) => { if (a?.session && a?.changes) canales.set(a.session, a.changes); return a?.session ?? "demo"; },
    unwatch_task_tree: (a) => { canales.delete(a?.id); return null; },
    tree_files: (a) => ({ paths: rutas(a?.session), folders: [], truncated: false }),
    preview_tree_files: () => ({ paths: rutas(null), folders: [], truncated: false }),
    tree_git_status: (a) => cambios(a?.session).map((c) => (c.status === "A" ? { path: c.path, index: "?", worktree: "?" } : { path: c.path, index: " ", worktree: "M" })),
    tree_summary: (a) => ({ base: "main", files: cambios(a?.session), added: suma(a?.session, "added"), removed: suma(a?.session, "removed") }),
    tree_changes: (a) => ({ base: "main", files: cambios(a?.session), added: suma(a?.session, "added"), removed: suma(a?.session, "removed"), patch: parcheDe(a?.session), truncated: false, warnings: [] }),
    tree_diff: (a) => ({ patch: parcheDe(a?.session, a?.path ?? a?.rel), retired: false }),
    // La pestaña «Cambios» de un archivo abierto.
    tree_patch: (a) => parcheDe(a?.session, a?.path),
    // Guardar desde el editor del archivo: queda como un cambio más del árbol.
    tree_write: (a) => {
      const texto = a?.text ?? a?.contents ?? a?.content ?? a?.body;
      if (a?.session && a?.path && typeof texto === "string") {
        if (NUEVOS[a.session]?.[a.path] !== undefined) NUEVOS[a.session][a.path] = texto;
        else (EDITADOS[a.session] ??= {})[a.path] = texto;
        avisarArbol(a.session);
      }
      return null;
    },
    tree_show: (a) => verArchivo(a?.session, a?.path ?? a?.rel),
    preview_tree_show: (a) => verArchivo(null, a?.path ?? a?.rel),
    preview_file: (a) => {
      const rel = a?.rel ?? String(a?.path ?? "").split("/").pop();
      const texto = Object.values(ARTEFACTOS).find((x) => rel in x)?.[rel] ?? "";
      return { rel, kind: "text", text: texto, data_url: null, bytes: texto.length, truncated: false };
    },
  };

  function proveedorDe(a = {}) {
    const ids = Object.values(a).filter((v) => typeof v === "string");
    return R.list_providers.find((p) => ids.includes(p.id)) ?? R.list_providers[0];
  }

  /* --------------------------------------------------------- el puente */

  const VACIO = { lista: () => [], bool: () => false, texto: () => "", numero: () => 0, registro: () => ({}), nulo: () => null, objeto: () => null };
  const sinGuion = new Set();
  window.__demoSinGuion = sinGuion; // lo que se contestó vacío, para quien depure

  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: (event, id) => oyentes.get(event)?.delete(id) };
  window.__TAURI_INTERNALS__ = {
    transformCallback: (cb) => { const id = callbacks.size + 1; callbacks.set(id, cb); return id; },
    unregisterCallback: (id) => callbacks.delete(id),
    convertFileSrc: (p) => p,
    metadata: { currentWindow: { label: "main" }, currentWebview: { windowLabel: "main", label: "main" } },
    invoke: (cmd, args) => {
      try {
        if (cmd === "plugin:event|listen") {
          if (!oyentes.has(args.event)) oyentes.set(args.event, new Set());
          oyentes.get(args.event).add(args.handler);
          return Promise.resolve(args.handler);
        }
        if (cmd === "plugin:event|unlisten") { oyentes.get(args.event)?.delete(args.eventId); return Promise.resolve(null); }
        if (cmd === "plugin:app|version") return Promise.resolve(D.version || "0.0.0");
        if (cmd.startsWith("plugin:")) return Promise.resolve(null);
        if (cmd in R) {
          const r = R[cmd];
          return Promise.resolve(typeof r === "function" ? r(args ?? {}) : r);
        }
        sinGuion.add(cmd);
        return Promise.resolve((VACIO[D.comandos[cmd]] ?? VACIO.nulo)());
      } catch (e) {
        return Promise.reject(e);
      }
    },
  };
  localStorage.setItem("harness:lengua", "es");

  /* ------------------------------------------------------- el guardia */

  /**
   * **No todo tiene que funcionar; lo que no funciona no debe romperse.**
   *
   * La demo no simula cada comando —conectar cuentas, instalar, borrar,
   * renombrar—, así que dejar tocar esos controles termina en un formulario
   * que nunca contesta o en un «Algo se rompió» de la propia app. En vez de ir
   * tapando cada caso, se cierra la puerta por defecto: **un clic o una tecla
   * solo hacen algo si están en la lista de abajo**, y lo que no reconoce se
   * bloquea, no se adivina. Si `harness-app` agrega un botón nuevo, esta lista
   * no lo sabe y lo bloquea sola — quedó afuera por diseño, no por descuido.
   *
   * Lo permitido es exactamente lo que tiene guion en este archivo: abrir
   * tareas, mostrar/ocultar las columnas, navegar el árbol y sus pestañas,
   * escribir y enviar un mensaje, empezar una tarea nueva —global o dentro de
   * una carpeta—, elegir el proyecto de una tarea nueva, el razonamiento y
   * los permisos del turno, y Configuración en modo lectura (sus secciones y
   * la Apariencia). Todo lo demás —cuentas, proveedores, instalar, borrar, el
   * selector de agente o modelo, crear un proyecto— no está en la lista, y
   * por eso no hace nada.
   */
  const AVISO = "En la demo esto no está disponible. Descarga Terminus para probarlo.";
  let toast = null;
  function avisar(texto) {
    if (!toast) {
      toast = document.createElement("div");
      toast.setAttribute("role", "status");
      Object.assign(toast.style, {
        position: "fixed", left: "50%", bottom: "18px", zIndex: 2147483647,
        transform: "translateX(-50%) translateY(10px)", opacity: "0",
        background: "#0a0d23", color: "#f7f8fc", maxWidth: "300px", textAlign: "center",
        font: "13px/1.4 -apple-system, system-ui, sans-serif", padding: "0.6rem 1rem",
        borderRadius: "8px", boxShadow: "0 8px 24px rgb(0 0 0 / 0.35)",
        pointerEvents: "none", transition: "opacity 150ms, transform 150ms",
      });
      (document.body ?? document.documentElement).appendChild(toast);
    }
    toast.textContent = texto;
    requestAnimationFrame(() => Object.assign(toast.style, { opacity: "1", transform: "translateX(-50%) translateY(0)" }));
    clearTimeout(avisar._t);
    avisar._t = setTimeout(() => Object.assign(toast.style, { opacity: "0", transform: "translateX(-50%) translateY(10px)" }), 2200);
  }

  const CONTROL = 'button, a[href], [role="tab"], [role="radio"], [role="checkbox"], summary, select';

  /**
   * **El árbol de trabajo no tiene una marca propia que decir «soy yo».** Es
   * código de `harness-app`, no de esta demo, así que se ubica por lo único
   * estable que sí tiene: el botón que lo cierra y el rótulo «Carpeta» que lo
   * encabeza. Sin ellos —columna cerrada— no hay nada que ubicar.
   */
  function regionDelArbol() {
    const cerrar = document.querySelector('button[aria-label="Cerrar el árbol de trabajo"]');
    if (!cerrar) return null;
    for (let n = cerrar.parentElement, i = 0; n && i < 14; n = n.parentElement, i++) {
      const tieneRotulo = Array.from(n.querySelectorAll("*")).some(
        (x) => x.childElementCount === 0 && x.textContent.trim() === "Carpeta",
      );
      if (tieneRotulo) return n;
    }
    return null;
  }

  function permitido(objetivo) {
    const control = objetivo.closest?.(CONTROL);
    if (!control) return true; // no es un control: no acciona nada de todos modos

    if (control.closest("[data-sesion]")) return true; // abrir una tarea

    if (control.matches('a[href^="http"], a[href^="mailto:"]')) return true; // el propio chat ya intercepta su navegación

    const etiqueta = control.getAttribute("aria-label") ?? "";
    if (
      [
        "Ocultar el historial", "Mostrar el historial",
        "Ver el árbol de trabajo", "Cerrar el árbol de trabajo",
        "Configuración", "Cerrar configuración (Esc)",
        "Preguntar", "Detener turno",
        "Nueva tarea", // el riel, siempre abre una tarea en blanco: `nuevaSesion()`
        "Proyecto", // el selector de «Sin proyecto ⌄» que arma esa tarea en blanco
      ].includes(etiqueta)
    ) return true;
    if (etiqueta.startsWith("Cerrar «")) return true; // cerrar una pestaña de tarea, no borrarla
    if (etiqueta.startsWith("Nueva tarea en ")) return true; // el «+» de un proyecto: misma acción, con destino fijo
    if (etiqueta.startsWith("Permisos: ")) return true; // el modo del turno: no toca ninguna cuenta
    // El botón grande de la portada de un proyecto no lleva `aria-label`,
    // solo el texto — misma llamada que el del riel (`nuevaSesion`).
    if (control.tagName === "BUTTON" && control.textContent.trim() === "Nueva tarea") return true;

    if (control.getAttribute("role") === "tab") return true; // cambiar de vista, nunca de dato

    if (control.getAttribute("role") === "radio") {
      return control.closest('[role="radiogroup"]')?.getAttribute("aria-label") === "Apariencia";
    }
    // Las opciones de permisos: mismo trato que la Apariencia, por el mismo
    // motivo — elegir aquí no llama a ningún proveedor.
    if (control.getAttribute("role") === "option") {
      return control.closest('[role="listbox"]')?.getAttribute("aria-label") === "Permisos";
    }
    // El razonamiento es un `<select>` nativo: el navegador pinta sus
    // opciones fuera del documento, así que ni siquiera llegan a este clic.
    if (control.tagName === "SELECT") return true;

    // Abrir o cerrar un desplegable es mirar, no tocar: lo que haga falta
    // dentro sigue su propia regla al clic siguiente.
    if (control.hasAttribute("aria-expanded")) return true;

    // El desplegable de «Sin proyecto ⌄»: sus opciones son botones sin marca
    // propia, así que se ubica por lo único suyo — el buscador que trae ese
    // panel y ningún otro (`ProjectPicker`, `projects.picker.search`).
    // «Nuevo proyecto…» se excluye: crear un proyecto no está guionado.
    const selectorDeProyecto = control.closest('[role="dialog"]');
    if (selectorDeProyecto?.querySelector('input[placeholder="Buscar carpeta"]')) {
      return control.textContent.trim() !== "Nuevo proyecto…";
    }

    const region = regionDelArbol();
    if (region?.contains(control)) {
      const texto = (control.getAttribute("aria-label") ?? control.getAttribute("title") ?? control.textContent ?? "").trim();
      return !["Exportar chat", "Abrir carpeta", "Copiar ruta", "Ruta copiada"].includes(texto);
    }

    return false;
  }

  document.addEventListener(
    "click",
    (e) => {
      if (permitido(e.target)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      avisar(AVISO);
    },
    true,
  );

  // Los atajos de teclado son la otra puerta de entrada a lo mismo: "Nueva
  // tarea" con Cmd+T, un Delete sobre una fila seleccionada. Se bloquea toda
  // combinación con Cmd/Ctrl salvo copiar, pegar y deshacer DENTRO de un
  // campo de texto —si no, no se podría ni escribir la tarea—, y todo Delete
  // o Backspace que no esté escribiendo en un campo. Escape siempre pasa:
  // solo cierra columnas y diálogos, nunca borra nada.
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape") return;
      const editable = /^(INPUT|TEXTAREA)$/.test(e.target?.tagName ?? "") || e.target?.isContentEditable;
      if (e.metaKey || e.ctrlKey) {
        if (editable && ["c", "v", "x", "a", "z"].includes(e.key.toLowerCase())) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        avisar(AVISO);
        return;
      }
      if (!editable && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        avisar(AVISO);
      }
    },
    true,
  );

  /**
   * **El campo de escribir crece hacia abajo, nunca hacia el lado.** Su
   * `overflow-x: auto` es de `harness-app`, no de aquí, y a veces basta que la
   * métrica de una fuente quede a un pixel del borde para que el navegador
   * reserve la barra horizontal aunque no haya nada que desplazar — se ve
   * escalado en la landing, y ahí un pixel de sobra se nota más. No hay nada
   * que desplazar de lado en una caja de una idea por línea, así que se cierra
   * del todo: la envolvente ya hace `overflow-y: auto` para el alto.
   */
  const estilo = document.createElement("style");
  estilo.textContent = "textarea { overflow-x: hidden !important; }";
  (document.head ?? document.documentElement).appendChild(estilo);

  /**
   * **Cambiar de tarea movía la página completa, no solo la conversación.**
   * La app enfoca el campo de escribir al abrir una tarea (`lib/focus.ts`), y
   * un `.focus()` sin `preventScroll` no solo desplaza el documento propio:
   * el navegador también corre el `<iframe>` entero a la vista dentro de LA
   * LANDING, porque a sus ojos hay un elemento enfocado fuera de pantalla que
   * «hay que enseñar» — el mismo mecanismo que baja la página cuando se
   * activa un campo en un formulario ajeno. Ningún foco de aquí necesita
   * mover nada: quien mira la demo ya está viéndola.
   */
  const enfocarOriginal = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function (opciones) {
    return enfocarOriginal.call(this, { ...opciones, preventScroll: true });
  };
})();
