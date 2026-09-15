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
  const MODELOS = {
    claude: [
      { id: "claude-opus-5", label: "Opus 5", note: null, efforts: [], default_effort: null, gratis: null },
      { id: "claude-sonnet-5", label: "Sonnet 5", note: null, efforts: [], default_effort: null, gratis: null },
    ],
    codex: [{ id: "gpt-5.6", label: "GPT-5.6", note: null, efforts: [], default_effort: null, gratis: null }],
  };

  /* ---------------------------------------------------- espacio y proyectos */

  const ESPACIO = {
    id: WS, name: "Danil", context_root: null, lengua: "es", lengua_de_salida: null,
    worktrees_root: null, provider: null, remote: null, memoria: { tipo: "local" },
    created_at: hace(60 * 24 * 30), sessions: 2,
  };
  const ARRANQUE = { workspaces: [ESPACIO], active: WS, migrations: [] };

  const proyecto = (id, kind) => ({
    id, name: id, node: null, sources: [], portfolio: null,
    working_directory: `${RAIZ}/${id}`, work_tree: null,
    created_at: hace(60 * 24 * 20), updated_at: hace(5), sessions: 1, kind, cloud: null,
  });
  const PROYECTOS = [proyecto("terminus-landing", "git"), proyecto("danil-workspace", "git")];
  const CON_ARBOL = "terminus-landing";

  const SESIONES = {
    "terminus-landing": [
      { id: "landing", title: "Simplificar la landing", agent: "claude", model: "claude-opus-5", updated_at: hace(4) },
    ],
    "danil-workspace": [
      { id: "docs", title: "Qué es Terminus hoy", agent: "codex", model: "gpt-5.6", updated_at: hace(90) },
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
    docs: [
      { role: "user", id: "u1", at: hace(95), text: "¿Qué dice la documentación que es Terminus?" },
      {
        role: "agent", id: "a1", at: hace(90), duration_ms: 41_000, model: "gpt-5.6",
        tools: [{ name: "Read", target: "docs/ARCHITECTURE.md", ok: true }],
        text: "Una app de escritorio para trabajar con agentes de terminal sobre el material de una organización. Corre en tu computadora, con la suscripción de cada persona, y no usa ningún servicio de Danil.",
      },
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

  const arbolDe = (s) => proyectoDe(s) !== CON_ARBOL ? [] : [{
    key: "work", name: CON_ARBOL, path: `${RAIZ}/${CON_ARBOL}`, origin: "declarada", kind: "git",
    cloud: null, source: null, remote: "https://github.com/danil-labs/terminus-landing",
    branch: "feat/landing-simple", missing: false, dirty_before: 0, changed: cambios(s).length, base_drift: null,
  }];
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
    list_session_git: () => Object.fromEntries(filas(CON_ARBOL).map((s) => [s.id, {
      kind: "branch", kn: null, branch: "feat/landing-simple", alias: "mizar-260915", head: D.commit || "4293fc5",
      repository: CON_ARBOL, shared_with: null, pull: null, pull_known: true, checked_at: Date.now(), stale: false,
    }])),
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
    session_usage: { records: [] },
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
})();
