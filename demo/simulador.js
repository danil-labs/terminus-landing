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
 * - **La ventana abre en una tarea.** Al arrancar, la app recuerda la tira de
 *   pestañas de cada espacio (`lib/tabs.ts`, `harness.layout.pestanas.*`); aquí
 *   se deja sembrada para que la demo enseñe una conversación y no la caja en
 *   blanco, que es lo que un cliente ve al volver.
 */
(() => {
  const D = window.__DEMO__ || { comandos: {}, archivos: {}, version: "" };
  const WS = "danil";
  const ahora = Date.now();
  const hace = (min) => ahora - min * 60_000;
  const RAIZ = "/Users/demo/Proyectos";

  /* ------------------------------------------------------------ agentes */

  // Un renglón por CLI de proveedor (`runtime/agents/table.rs`). Lo que decide
  // si se puede correr un turno es `driver`; lo que decide si se monta el
  // bloque de consumo es `limits`.
  const AGENTES = [
    { id: "claude", label: "Claude Code", limits: true, inferencia: "con_cuenta" },
    { id: "codex", label: "Codex", limits: true, inferencia: "con_cuenta" },
    { id: "grok", label: "Grok", limits: false, inferencia: "con_cuenta" },
    { id: "antigravity", label: "Antigravity", limits: false, inferencia: "con_cuenta" },
    // «Sin pedir nada», como en la tabla real: por eso da dos superficies,
    // «OpenCode» y «Modelos Free» (`surfaces.rs`, `declaradas`).
    { id: "opencode-zen", label: "OpenCode", limits: false, inferencia: "sin_pedir_nada" },
    { id: "opencode-local", label: "Locales", limits: false, inferencia: "en_la_maquina", sin_cuenta: true },
  ].map((a) => ({
    available: true, driver: true, sin_cuenta: false, api_key: null,
    path: `/Users/demo/.local/bin/${a.id}`, version: "1.0.0", ...a,
  }));
  const etiqueta = (id) => AGENTES.find((a) => a.id === id)?.label ?? "El agente";

  // Las cuentas conectadas en la demo: todos los agentes que piden una. Solo
  // Claude y Codex traen ventanas de consumo, que es lo que la barra de abajo
  // enseña (`account_limits`).
  const CONECTADAS = {
    claude: [["últimas 5 horas", 22, 2.2], ["esta semana", 41, 76]],
    codex: [["últimas 5 horas", 36, 3.5], ["esta semana", 18, 101]],
    grok: [],
    antigravity: [],
    "opencode-zen": [],
  };
  // El catálogo que la app arma sin preguntarle nada al CLI
  // (`runtime/models.rs`): los alias de Claude con su nombre y su nota, y la
  // lista de respaldo de Codex. Los esfuerzos son los mismos que manda la app
  // —`CLAUDE_EFFORTS`, `CODEX_FALLBACK_EFFORTS`— y se pintan tal cual. Claude
  // no trae esfuerzo por omisión: la opción vacía dice «razonamiento» y lo
  // decide el agente.
  const CLAUDE_ESFUERZOS = ["low", "medium", "high", "xhigh", "max"];
  const CODEX_ESFUERZOS = ["low", "medium", "high", "xhigh"];
  const MODELOS = {
    claude: [
      ["sonnet", "Claude Sonnet 5", "equilibrio entre capacidad y velocidad"],
      ["opus", "Claude Opus 5", "el más capaz"],
      ["haiku", "Claude Haiku 4.5", "el más rápido"],
      ["fable", "Claude Fable 5.1", "el más nuevo de la familia"],
    ].map(([id, label, note]) => ({ id, label, note, gratis: null, efforts: CLAUDE_ESFUERZOS, default_effort: null })),
    codex: ["gpt-6-astra", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna", "gpt-5.5"]
      .map((id) => ({ id, label: id, note: null, gratis: null, efforts: CODEX_ESFUERZOS, default_effort: "medium" })),
    grok: [{ id: "grok-code-fast-1", label: "grok-code-fast-1", note: null, gratis: null, efforts: ["low", "medium", "high"], default_effort: "high" }],
    antigravity: ["gemini-3.6-flash-high", "gemini-3.6-flash-medium"]
      .map((id) => ({ id, label: id, note: null, gratis: null, efforts: [], default_effort: null })),
    "opencode-zen": [{ id: "opencode/hy3-free", label: "opencode/hy3-free", note: null, gratis: true, efforts: [], default_effort: null }],
    "opencode-local": [{ id: "llamacpp/qwen3.5-4b", label: "Qwen3.5 4B", note: "en esta computadora, con llama.cpp", gratis: null, efforts: [], default_effort: null }],
  };
  // Los tres modos reales de `Modo::CICLO` (`runtime/agents/types.rs`), con
  // sus ids y frases exactas. «Acepta ediciones» es el que trae la app de
  // fábrica (`Modo::OMISION`), y así arranca aquí también.
  const MODOS_DE_PERMISO = [
    { id: "manual", label: { clave: "agents.mode.manual" }, falta: null, por_omision: false },
    { id: "ediciones", label: { clave: "agents.mode.edits" }, falta: null, por_omision: true },
    { id: "auto", label: { clave: "agents.mode.auto" }, falta: null, por_omision: false },
  ];

  /* ------------------------------------------------ espacio y proyectos */

  const ESPACIO = {
    id: WS, name: "Danil", context_root: `${RAIZ}/danil-workspace`, lengua: "es", lengua_de_salida: null,
    terminal_theme: null, default_permission_mode: null, worktrees_root: null, provider: null, remote: null,
    memoria: { tipo: "local" }, created_at: hace(60 * 24 * 30), sessions: 2,
  };
  const ARRANQUE = { workspaces: [ESPACIO], active: WS, migrations: [] };

  // **Los espacios** (`workspace/spaces.rs`): un escritorio dentro del
  // workspace, con sus carpetas. El riel enseña las de uno; compartir tarea
  // entre clientes se hace cambiando de espacio. Dos, para que la barra de
  // pestañas de espacio se vea y se pueda cambiar.
  const ESPACIOS = [
    {
      id: "producto", name: "Producto", folders: ["terminus-landing", "danil-workspace"],
      created_at: hace(60 * 24 * 20), updated_at: hace(3),
    },
    {
      id: "clientes", name: "Clientes", folders: ["documentos-clientes", "marketing-drive"],
      created_at: hace(60 * 24 * 12), updated_at: hace(40),
    },
  ];
  const espacioDe = (p) => ESPACIOS.find((e) => e.folders.includes(p))?.id ?? null;

  const proyecto = (id, name, kind, cloud = null) => ({
    id, name, node: null, sources: [], portfolio: null,
    working_directory: `${RAIZ}/${id}`, work_tree: null,
    created_at: hace(60 * 24 * 20), updated_at: hace(5), sessions: 1, kind, cloud,
  });
  const PROYECTOS = [
    // El repositorio de esta landing: su material es el que la demo abre.
    { ...proyecto("terminus-landing", "terminus-landing", "git"), sources: ["landing"] },
    proyecto("danil-workspace", "danil-workspace", "git"),
    // Carpeta de documentos, sin git: donde viven los estados «borrador» y
    // «guardado» (`GitStatus.kn`, ver `taskGit.ts`).
    proyecto("documentos-clientes", "Documentos de clientes", "folder"),
    // Una carpeta en la nube: mismo tipo «folder», con su proveedor. El icono
    // de nube lo decide `WorkdirIcon` a partir de este campo.
    proyecto("marketing-drive", "Campañas (Drive)", "folder", "google_drive"),
  ];
  const CON_ARBOL = "terminus-landing";

  // **El material** (`context::SourceInfo`). La raíz de gobierno y el
  // repositorio de la landing, que es lo que la tarea abierta lee.
  const FUENTES = [
    {
      id: "raiz", kind: "folder", identity: "raiz", name: "danil-workspace",
      location: `${RAIZ}/danil-workspace`, branch: null, etiqueta: "danil-workspace",
      parent: null, skills: true, added_at: hace(60 * 24 * 30), path: `${RAIZ}/danil-workspace`,
      missing: false, root: true, project_attachable: false, projects: [], sessions: 0,
    },
    {
      id: "landing", kind: "git", identity: "landing", name: "terminus-landing",
      location: `${RAIZ}/terminus-landing`, branch: "main", etiqueta: "terminus-landing · main",
      parent: null, skills: false, added_at: hace(60 * 24 * 20), path: `${RAIZ}/terminus-landing`,
      missing: false, root: false, project_attachable: true, projects: ["terminus-landing"], sessions: 4,
      traido_en: String(Math.floor(hace(180) / 1000)),
    },
  ];

  /* --------------------------------------------------------- encargados */

  // **Un encargado no es un CLI**: es una identidad de trabajo declarada en el
  // material del proyecto (`docs/agents.md`), con instrucciones y un criterio.
  // El frontmatter vive en `.agents/agents/<name>.md`; la app lo lee, no lo
  // escribe. Los nombres van en inglés y kebab-case, como manda el contrato.
  const declarado = (project, name, description, instructions, tools, model) => ({
    name, description, instructions, tools, model,
    origin: `${RAIZ}/${project}/.agents/agents/${name}.md`,
    folder: null,
    agents: ["claude", "codex"],
    own: false, own_scope: null,
  });
  const propio = (project, name, description, instructions, tools, model) => ({
    ...declarado(project, name, description, instructions, tools, model),
    origin: `${project} · creado en la app`,
    own: true, own_scope: { kind: "project", id: project },
  });

  const ENCARGADOS = {
    "terminus-landing": [
      declarado("terminus-landing", "tech-lead",
        "Decide qué entra a la página y revisa que diga la verdad.",
        "Cada frase de la landing tiene que poder comprobarse en la app. Si algo no se puede verificar, no se publica.",
        ["Read", "Grep", "Edit", "Bash"], null),
      declarado("terminus-landing", "design",
        "Cuida la presencia visual y la jerarquía de la página.",
        "Una sola idea por sección. Sin gradientes decorativos, sin relleno de venta. El movimiento se gana, no se pinta.",
        ["Read", "Edit"], null),
      declarado("terminus-landing", "qa",
        "Prueba la página y sus regresiones antes de publicar.",
        "Antes de dar algo por bueno, córrelo: compila, revisa el HTML y mira que ninguna promesa quede huérfana.",
        ["Read", "Bash"], null),
      propio("terminus-landing", "contenido",
        "Escribe secciones nuevas a partir del material del repositorio.",
        "Lee el README y la app antes de escribir. Nada que la app no haga hoy.",
        ["Read", "Write"], null),
    ],
    "danil-workspace": [
      declarado("danil-workspace", "architect",
        "Escribe y ordena la documentación del proyecto.",
        "Un documento por decisión. Lo diseñado y no construido se marca como tal, con su estado.",
        ["Read", "Write", "Edit"], null),
    ],
    "documentos-clientes": [
      declarado("documentos-clientes", "support",
        "Prepara respuestas y documentos de soporte.",
        "Tono claro y directo. Lo que no se pueda prometer, no se promete.",
        ["Read", "Write"], null),
    ],
    "marketing-drive": [
      declarado("marketing-drive", "campaigns",
        "Resume campañas y arma el material de marketing.",
        "Cada resumen dice el objetivo, el canal y las fechas. Sin adjetivos que no estén en la fuente.",
        ["Read", "Write"], null),
    ],
  };

  // Lo que la app le pone encima a la declaración: cara, nombre visible y con
  // qué CLI arranca. Vive en app data, nunca en el material (`AgentProfile`).
  const perfil = (body, agent, model, effort) => ({
    display_name: null, body, background: null, avatar: null, veil: 0, agent, model, effort, hidden: false,
  });
  const PERFILES = {
    "terminus-landing": {
      "tech-lead": perfil("sun", "claude", "opus", "high"),
      design: perfil("planet", "antigravity", "gemini-3.6-flash-medium", null),
      qa: perfil("moon", "grok", "grok-code-fast-1", null),
      contenido: perfil("nebula", "claude", "sonnet", null),
    },
    "danil-workspace": { architect: perfil("ringed", "codex", "gpt-5.6-sol", "medium") },
    "documentos-clientes": { support: perfil("dwarf", "claude", "sonnet", null) },
    "marketing-drive": { campaigns: perfil("comet", "codex", "gpt-5.6-sol", "medium") },
  };
  // La presencia de cada encargado (`EncargadoStatus`): qué se agregó sobre
  // todas sus tareas —gana la más activa— y cuántas tienen proceso vivo.
  const PRESENCIA = {
    "terminus-landing": [
      { name: "tech-lead", status: "awake", minutes_since_last_turn: 4, live_tasks: 0 },
      { name: "design", status: "asleep", minutes_since_last_turn: 210, live_tasks: 0 },
      { name: "qa", status: "asleep", minutes_since_last_turn: 1400, live_tasks: 0 },
      { name: "contenido", status: "asleep", minutes_since_last_turn: null, live_tasks: 0 },
    ],
    "danil-workspace": [{ name: "architect", status: "asleep", minutes_since_last_turn: 90, live_tasks: 0 }],
    "documentos-clientes": [{ name: "support", status: "asleep", minutes_since_last_turn: 30, live_tasks: 0 }],
    "marketing-drive": [{ name: "campaigns", status: "asleep", minutes_since_last_turn: 50, live_tasks: 0 }],
  };

  /* ------------------------------------------------------------ sesiones */

  const SESIONES = {
    "terminus-landing": [
      { id: "landing", title: "Simplificar la landing", agent: "claude", model: "opus", encargado: "tech-lead", updated_at: hace(4), pinned: true },
      // Un worktree sin rama: el agente todavía no hizo el primer commit que
      // le da nombre (`ARCHITECTURE.md` § 1 — «la app no crea ninguna rama»).
      { id: "sin-rama", title: "Explorar otra idea de hero", agent: "antigravity", model: "gemini-3.6-flash-medium", encargado: "design", updated_at: hace(210) },
      { id: "pr-abierto", title: "Agregar aviso de SmartScreen", agent: "grok", model: "grok-code-fast-1", encargado: "qa", stage: "review", updated_at: hace(1400) },
      { id: "pr-mergeado", title: "Corregir el aria-label del árbol", agent: "opencode-zen", model: "opencode/hy3-free", encargado: "tech-lead", stage: "done", updated_at: hace(4200) },
    ],
    "danil-workspace": [
      { id: "docs", title: "Qué es Terminus hoy", agent: "codex", model: "gpt-5.6-sol", encargado: "architect", updated_at: hace(90) },
    ],
    "documentos-clientes": [
      { id: "borrador-cliente", title: "Política de reembolsos", agent: "claude", model: "sonnet", encargado: "support", updated_at: hace(30) },
      { id: "guardado-cliente", title: "Preguntas frecuentes de soporte", agent: "codex", model: "gpt-5.6-sol", encargado: "support", updated_at: hace(2600) },
    ],
    "marketing-drive": [
      { id: "campaña-q4", title: "Resumen de la campaña de Q4", agent: "codex", model: "gpt-5.6-sol", encargado: "campaigns", updated_at: hace(50) },
    ],
  };

  // **Las tareas de ejemplo cuentan un trabajo entero**, no una respuesta
  // suelta: varios turnos, las herramientas del agente, una pregunta con
  // opciones, una salida de terminal y —en las de código— el bloque de
  // cambios que la app pinta cuando un turno trae `code` (un par de commits,
  // `lib/model.ts`). Ese diff lo contesta `tree_diff` desde aquí, con la
  // clave `antes..después`. Los fragmentos son de la landing real: el hero de
  // antes y el de ahora, la tabla de permisos que salió de la página.
  const CAMBIOS_GUARDADOS = {
    "e5a0c2b..4293fc5": [
      ["src/pages/index.astro",
        "      <section class=\"envoltura hero\">\n        <p class=\"diff\">\n          <span class=\"mono\">inteligencia</span>\n          <span class=\"diff__tachado mono\">artificial</span>\n        </p>\n        <p class=\"pastilla\">Aplicación de escritorio · Windows y macOS</p>\n        <h1>El agente hace el trabajo. Tú apruebas lo que sale.</h1>\n        <p class=\"hero__bajada\">\n          Agentes de terminal corriendo dentro de una app, sobre una carpeta\n          de documentos o un repositorio, con tu propia suscripción.\n        </p>\n",
        "      <section class=\"envoltura hero\">\n        <h1>Tus agentes de IA, en una sola app.</h1>\n        <p class=\"bajada\">\n          Terminus es una app de escritorio para trabajar con agentes de IA sobre\n          tus carpetas y repositorios, con tus propias cuentas.\n        </p>\n"],
      ["README.md",
        "## Despliegue\n\nSe publica en Cloudflare con `wrangler deploy` (dominio `terminus.danil.ai`).\n",
        "## Permisos de la GitHub App\n\n| Permiso | Nivel | Para qué |\n|---|---|---|\n| contents | escritura | Leer el repo y crear ramas |\n| pull_requests | escritura | Abrir la propuesta de cambio |\n| issues | escritura | Comentar y abrir issues |\n| metadata | lectura | Lo que GitHub añade a todas |\n\n## Despliegue\n\nSe publica en Cloudflare con `wrangler deploy` (dominio `terminus.danil.ai`).\n"],
    ],
    "9a0c3e2..a1c02ef": [
      ["src/styles/global.css",
        ".hero {\n  padding: clamp(4.5rem, 11vw, 8rem) 0 3.5rem;\n  text-align: center;\n}\n",
        ".hero {\n  display: grid;\n  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);\n  align-items: center;\n  gap: 3rem;\n  padding: clamp(3rem, 8vw, 6rem) 0 3rem;\n  text-align: left;\n}\n.hero .demo {\n  grid-column: 1;\n  grid-row: 1 / span 4;\n}\n"],
    ],
    "5d21c88..7f0d914": [
      ["src/pages/index.astro",
        "        <p class=\"datos\">\n          Windows 10 u 11 y macOS\n        </p>\n",
        "        <p class=\"datos\">\n          Windows 10 u 11 y macOS\n        </p>\n        <p class=\"aviso\">\n          Firmada. Windows puede avisar la primera vez:\n          <span class=\"mono\">Más información → Ejecutar de todos modos</span>.\n        </p>\n"],
      ["src/styles/global.css",
        ".datos {\n  margin: 1.1rem 0 0;\n  font-size: 0.8rem;\n  color: var(--texto-tenue);\n}\n",
        ".datos {\n  margin: 1.1rem 0 0;\n  font-size: 0.8rem;\n  color: var(--texto-tenue);\n}\n.aviso {\n  margin: 0.4rem 0 0;\n  font-size: 0.78rem;\n  color: var(--texto-tenue);\n}\n"],
    ],
    "2f9e6a1..3bb27a0": [
      ["src/components/Demo.astro",
        "      <iframe\n        src=\"/demo/\"\n        width={ANCHO}\n        height={ALTO}\n        loading=\"lazy\"></iframe>\n",
        "      <iframe\n        src=\"/demo/\"\n        title=\"Terminus: la app real, con respuestas simuladas\"\n        width={ANCHO}\n        height={ALTO}\n        loading=\"lazy\"></iframe>\n"],
    ],
  };

  const TURNOS = {
    landing: [
      { role: "user", id: "u1", at: hace(52), text: "Revisa la landing de terminus.danil.ai contra lo que hace la app hoy. Quiero algo mucho más simple." },
      {
        role: "agent", id: "a1", at: hace(47), duration_ms: 212_000, model: "opus",
        tools: [
          { name: "Read", target: "src/pages/index.astro", ok: true },
          { name: "Read", target: "src/styles/global.css", ok: true },
          { name: "Grep", target: "gobernanza", ok: true },
          { name: "Read", target: "README.md", ok: true },
        ],
        text: "Encontré tres problemas:\n\n1. **Promete lo que la app ya no hace**: «tú apruebas lo que sale» y el material «solo lectura».\n2. **Once secciones**, varias de detalle técnico: permisos, idiomas, servidores MCP, firma de código.\n3. **Tres mensajes distintos** entre la landing, el README y la app.\n\nPropongo un hero, tres pasos tomados del onboarding y la descarga. Antes de tocar nada, una duda:",
        questions: [{
          id: "permisos", question: "¿Qué hago con la tabla de permisos de la GitHub App?", multiple: false, free_text: false,
          options: [
            { value: "quitar", label: "Quitarla" },
            { value: "readme", label: "Moverla al README", detail: "Sigue documentada, pero fuera de la página" },
            { value: "dejar", label: "Dejarla como está" },
          ],
        }],
      },
      // **La respuesta va en su propio turno, no en el que preguntó.** Un
      // mensaje con `answers` no se pinta (`bloques` lo salta): solo alimenta
      // el registro de preguntas del turno al que contesta, por su `turn`.
      // Con las dos cosas juntas, el turno que preguntaba desaparecía entero.
      {
        role: "user", id: "u1b", at: hace(45), text: "",
        answers: [{ turn: "a1", question: "permisos", question_text: "¿Qué hago con la tabla de permisos de la GitHub App?", chosen: ["readme"], text: "Moverla al README", source: "persona", when: hace(45) }],
      },
      {
        role: "agent", id: "a2", at: hace(38), duration_ms: 256_000, model: "opus",
        tools: [
          { name: "Edit", target: "src/pages/index.astro", ok: true },
          { name: "Edit", target: "README.md", ok: true },
        ],
        text: "Hecho. El hero dice una sola cosa y los permisos quedaron en el README:\n\n```astro\n<h1>Tus agentes de IA, en una sola app.</h1>\n```\n\nQuité el tachado de «artificial» y la pastilla de plataformas: la descarga ya dice para qué sistemas es.",
        code: [{ tree: "work", before: "e5a0c2b", after: "4293fc5" }],
      },
      {
        role: "user", id: "u2", at: hace(36), text: "npm run build",
        shell: { cwd: `${RAIZ}/terminus-landing`, output: "> terminus-web@0.0.0 build\n> astro build\n\n generating static routes\n▶ src/pages/index.astro\n  └─ /index.html (+402ms)\n✓ Completed in 406ms.\n1 page(s) built in 731ms\nComplete!", exit_code: 0, duration_ms: 1_900, truncated: false },
      },
      { role: "user", id: "u3", at: hace(35), text: "Compila. ¿Algo más que se te haya quedado?" },
      {
        role: "agent", id: "a3", at: hace(33), duration_ms: 64_000, model: "opus",
        tools: [{ name: "Grep", target: "SmartScreen", ok: true }],
        text: "Una cosa: el aviso de SmartScreen ya no está junto al botón de Windows. Lo dejé fuera a propósito —la página quedó en una idea, tres pasos y la descarga—, pero si lo quieres de vuelta es un renglón.",
      },
    ],
    "sin-rama": [
      { role: "user", id: "u1", at: hace(230), text: "Antes de tocar nada, prueba una versión del hero con la demo a la izquierda." },
      {
        role: "agent", id: "a1", at: hace(222), duration_ms: 95_000, model: "gemini-3.6-flash-medium",
        tools: [
          { name: "Read", target: "src/styles/global.css", ok: true },
          { name: "Edit", target: "src/styles/global.css", ok: true },
        ],
        text: "Lo probé en esta copia, sin rama todavía: el hero pasa a dos columnas, con la demo a la izquierda y el texto a la derecha.",
        code: [{ tree: "work", before: "9a0c3e2", after: "a1c02ef" }],
      },
      { role: "user", id: "u2", at: hace(215), text: "Mmm, el título pierde fuerza. Déjalo así por ahora." },
      { role: "agent", id: "a2", at: hace(210), duration_ms: 8_000, model: "gemini-3.6-flash-medium", text: "Queda en esta copia y tu carpeta no se tocó. Si la retomas, sigo desde aquí; si no, la puedes finalizar." },
    ],
    "pr-abierto": [
      { role: "user", id: "u1", at: hace(1430), text: "Falta el aviso de SmartScreen junto al botón de Windows." },
      {
        role: "agent", id: "a1", at: hace(1418), duration_ms: 118_000, model: "grok-code-fast-1",
        tools: [
          { name: "Read", target: "src/pages/index.astro", ok: true },
          { name: "Edit", target: "src/pages/index.astro", ok: true },
          { name: "Edit", target: "src/styles/global.css", ok: true },
        ],
        text: "Agregado debajo de la versión, con el mismo texto que usa el README del instalador.",
        code: [{ tree: "work", before: "5d21c88", after: "7f0d914" }],
      },
      { role: "user", id: "u2", at: hace(1410), text: "Súbelo y abre el PR." },
      {
        role: "agent", id: "a2", at: hace(1400), duration_ms: 41_000, model: "grok-code-fast-1",
        tools: [
          { name: "Bash", target: "git switch -c fix/smartscreen-aviso", ok: true },
          { name: "Bash", target: "git push -u origin fix/smartscreen-aviso", ok: true },
          { name: "Bash", target: "gh pr create --fill", ok: true },
        ],
        text: "Listo: la rama es `fix/smartscreen-aviso` y el pull request **#21** quedó abierto, con las pruebas pasando. Falta la revisión.",
      },
    ],
    "pr-mergeado": [
      { role: "user", id: "u1", at: hace(4240), text: "El iframe de la demo no dice qué es cuando lo lee un lector de pantalla." },
      {
        role: "agent", id: "a1", at: hace(4232), duration_ms: 73_000, model: "opencode/hy3-free",
        tools: [
          { name: "Read", target: "src/components/Demo.astro", ok: true },
          { name: "Edit", target: "src/components/Demo.astro", ok: true },
        ],
        text: "Le faltaba `title`, que es lo que anuncia un lector de pantalla al entrar a un iframe:\n\n```astro\n<iframe\n  src=\"/demo/\"\n  title=\"Terminus: la app real, con respuestas simuladas\"\n```",
        code: [{ tree: "work", before: "2f9e6a1", after: "3bb27a0" }],
      },
      { role: "user", id: "u2", at: hace(4225), text: "Abre el PR." },
      {
        role: "agent", id: "a2", at: hace(4220), duration_ms: 36_000, model: "opencode/hy3-free",
        tools: [
          { name: "Bash", target: "git push -u origin fix/aria-arbol", ok: true },
          { name: "Bash", target: "gh pr create --fill", ok: true },
        ],
        text: "Abierto como **#14**.",
      },
      { role: "user", id: "u3", at: hace(4205), text: "Ya lo aprobaron y se fusionó." },
      { role: "agent", id: "a3", at: hace(4200), duration_ms: 5_000, model: "opencode/hy3-free", text: "Entonces esta tarea ya cumplió. Con el cohete la finalizas: se archiva y se borran el worktree y la rama local; el pull request se queda registrado." },
    ],
    docs: [
      { role: "user", id: "u1", at: hace(100), text: "¿Qué dice la documentación que es Terminus?" },
      {
        role: "agent", id: "a1", at: hace(96), duration_ms: 41_000, model: "gpt-5.6-sol",
        tools: [
          { name: "Read", target: "docs/ARCHITECTURE.md", ok: true },
          { name: "Read", target: "README.md", ok: true },
        ],
        text: "Una app de escritorio para trabajar con agentes de terminal sobre el material de una organización:\n\n- Corre en la computadora de quien la usa, **con la suscripción de cada persona**.\n- No usa ningún servicio de Danil: ni servidores, ni base de datos.\n- Lo que sale de la máquina es poco y está listado: los CLIs contra su proveedor, GitHub o Bitbucket para clonar, los servidores MCP que conectes y el updater.",
      },
      { role: "user", id: "u2", at: hace(93), text: "¿Y qué NO es?" },
      {
        role: "agent", id: "a2", at: hace(90), duration_ms: 22_000, model: "gpt-5.6-sol",
        tools: [{ name: "Grep", target: "appv2", ok: true }],
        text: "No es `appv2` ni una versión de ella: esa corre en la nube con los servicios de Danil. Tampoco tiene todavía una sección de agentes locales —la documentación la marca como **visión**, no como algo construido.",
      },
    ],
    "borrador-cliente": [
      { role: "user", id: "u1", at: hace(36), text: "Escribe la política de reembolsos para el plan Starter." },
      {
        role: "agent", id: "a1", at: hace(31), duration_ms: 71_000, model: "sonnet",
        tools: [
          { name: "Read", target: "planes.md", ok: true },
          { name: "Write", target: "politica-reembolsos.md", ok: true },
        ],
        text: "Aquí tienes un primer borrador. Todavía **no está guardado** en tu carpeta: revísalo y, si te sirve, lo guardas desde la tarea.",
        artifacts: [{ rel: "politica-reembolsos.md", bytes: 612, revision: false }],
      },
    ],
    "guardado-cliente": [
      { role: "user", id: "u1", at: hace(2615), text: "Junta las preguntas que más hace soporte sobre facturación." },
      {
        role: "agent", id: "a1", at: hace(2608), duration_ms: 54_000, model: "gpt-5.6-sol",
        tools: [
          { name: "Read", target: "tickets-agosto.csv", ok: true },
          { name: "Write", target: "preguntas-frecuentes.md", ok: true },
        ],
        text: "Salieron cinco que concentran casi todos los tickets. Te las dejé con su respuesta corta.",
        artifacts: [{ rel: "preguntas-frecuentes.md", bytes: 540, revision: false }],
      },
      { role: "user", id: "u2", at: hace(2604), text: "Perfecto, guárdalo." },
      { role: "agent", id: "a2", at: hace(2600), duration_ms: 3_000, model: "gpt-5.6-sol", text: "Guardado en tu carpeta de documentos." },
    ],
    "campaña-q4": [
      { role: "user", id: "u1", at: hace(56), text: "Resume qué hay en la carpeta de la campaña de Q4." },
      {
        role: "agent", id: "a1", at: hace(50), duration_ms: 33_000, model: "gpt-5.6-sol",
        tools: [
          { name: "Read", target: "briefing-q4.docx", ok: true },
          { name: "Read", target: "presupuesto-q4.xlsx", ok: true },
          { name: "Read", target: "calendario.md", ok: true },
        ],
        text: "Esto es una demo: la respuesta está simulada. En Terminus, el agente lee de verdad los archivos de tu Drive, sin copiarlos a ningún servidor de Danil.\n\n| Archivo | Qué es |\n|---|---|\n| briefing-q4.docx | Objetivos y mensajes de la campaña |\n| presupuesto-q4.xlsx | Presupuesto por canal |\n| calendario.md | Fechas de lanzamiento |",
      },
    ],
  };
  // Lo que produjeron las tareas guardadas, para que la tarjeta «Produjo…»
  // abra un archivo con contenido.
  const ARTEFACTOS = {
    "borrador-cliente": {
      "politica-reembolsos.md": "# Política de reembolsos — plan Starter\n\n**Borrador.**\n\n- Puedes pedir el reembolso completo en los primeros **14 días** desde el primer cobro.\n- Después de ese plazo no hay reembolsos parciales: el plan sigue activo hasta el fin del periodo pagado.\n- Si cambias a un plan más barato, la diferencia queda como saldo a favor.\n\n## Cómo pedirlo\n\nEscribe a soporte con el correo de la cuenta. Respondemos en dos días hábiles.\n",
    },
    "guardado-cliente": {
      "preguntas-frecuentes.md": "# Preguntas frecuentes de facturación\n\n1. **¿Cuándo se me cobra?** El mismo día de cada mes en que te suscribiste.\n2. **¿Puedo cambiar de plan?** Sí, en cualquier momento; el cambio se prorratea.\n3. **¿Dónde está mi factura?** En Configuración → Facturación.\n4. **¿Qué pasa si falla un pago?** Reintentamos tres días y te avisamos por correo.\n5. **¿Puedo pagar anual?** Sí, con dos meses de descuento.\n",
    },
  };

  const filas = (p) => (p ? SESIONES[p] ?? [] : Object.values(SESIONES).flat());
  const sesion = (id) => Object.values(SESIONES).flat().find((s) => s.id === id);
  const proyectoDe = (id) => Object.keys(SESIONES).find((p) => SESIONES[p].some((s) => s.id === id));
  const fila = (s, p) => {
    const turnos = TURNOS[s.id] ?? [];
    const ultimo = [...turnos].reverse().find((t) => t.role === "agent");
    return {
      id: s.id, title: s.title, agent: s.agent, model: s.model, refs: s.refs ?? [], project: p,
      created_at: turnos[0]?.at ?? s.updated_at, updated_at: s.updated_at, turns: turnos.length,
      parent: s.parent ?? null, subagent: s.subagent ?? null, esperando: false,
      archived: s.archived === true,
      outcome: s.outcome ?? null,
      pinned: s.pinned ?? false,
      stage: s.stage ?? null,
      encargado: s.encargado ?? null,
      encargado_del_padre: s.encargado_del_padre ?? null,
      chat_de_agente: s.chat_de_agente === true,
      agent_thread: false,
      space: s.space ?? espacioDe(p),
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
    landing: { kind: "branch", kn: null, branch: "feat/landing-simple", alias: "mizar-260915", head: D.commit || "4293fc5", pull: null },
    "sin-rama": { kind: "detached", kn: null, branch: null, alias: "vega-260908", head: "a1c02ef", pull: null },
    "pr-abierto": { kind: "branch", kn: null, branch: "fix/smartscreen-aviso", alias: "rigel-260901", head: "7f0d914", pull: { number: 21, state: "open", head_sha: "7f0d914", checks: "passed", review: "pending" } },
    "pr-mergeado": { kind: "branch", kn: null, branch: "fix/aria-arbol", alias: "denebola-260825", head: "3bb27a0", pull: { number: 14, state: "merged", head_sha: "3bb27a0", checks: "passed", review: "approved" } },
    docs: { kind: "branch", kn: null, branch: "main", alias: "phecda-260910", head: "e5a0c2b", pull: null },
    "borrador-cliente": { kind: "kn", kn: "draft", branch: null, alias: null, head: null, pull: null },
    "guardado-cliente": { kind: "kn", kn: "saved", branch: null, alias: null, head: null, pull: null },
    "campaña-q4": { kind: "none", kn: null, branch: null, alias: null, head: null, pull: null },
  };
  // **Una tarea nueva también tiene estado**, y no puede ser el de otra. En un
  // repositorio nace en su worktree con HEAD separado —la rama la pone el
  // agente cuando el trabajo merece nombre (`ARCHITECTURE.md` § 1)—; en una
  // carpeta de documentos nace en borrador. Sin esto, las tareas creadas en la
  // demo se quedaban sin árbol de trabajo justo cuando el agente decía que los
  // cambios estaban ahí.
  // Finalizar (el cohete) es archivar y además quitar el worktree y la rama
  // local (`projects.sessions.finish_description`). El pull request no se
  // borra: su registro se queda con la tarea.
  const FINALIZADAS = new Set();
  const gitDe = (s) => {
    if (FINALIZADAS.has(s)) return { kind: "none", kn: null, branch: null, alias: null, head: null, pull: GIT[s]?.pull ?? null };
    if (GIT[s]) return GIT[s];
    const p = proyectoDe(s);
    const carpeta = PROYECTOS.find((x) => x.id === p)?.kind === "folder";
    if (p === CON_ARBOL) return { kind: "detached", kn: null, branch: null, alias: "sirius-260915", head: null, pull: null };
    return { kind: carpeta ? "kn" : "none", kn: carpeta ? "draft" : null, branch: null, alias: null, head: null, pull: null };
  };
  const DERIVA = { status: "current", behind: null, recent_subjects: [] };

  const arbolDe = (s) => proyectoDe(s) !== CON_ARBOL || FINALIZADAS.has(s) ? [] : [{
    key: "work", name: CON_ARBOL, path: `${RAIZ}/${CON_ARBOL}`, origin: "declarada", kind: "git",
    cloud: null, source: "landing", remote: "https://github.com/danil-labs/terminus-landing",
    branch: gitDe(s).branch ?? "", alias: gitDe(s).alias ?? "sirius-260915",
    missing: false, dirty_before: 0, changed: cambios(s).length, base_drift: DERIVA,
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
      (SESIONES[p] ??= []).unshift({
        id: s, title: titulo, agent: agente, model: modelo,
        encargado: a.encargado ?? null, space: a.space ?? espacioDe(p), updated_at: Date.now(),
      });
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
      ready: true, blocked: false, reason: null, build: D.commit || "local", bootstrap: [], firstRun: false,
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
    list_spaces: ESPACIOS,
    list_projects: PROYECTOS,
    list_sources: FUENTES,
    // Solo las del proyecto que se pregunta. La app las agrupa por carpeta.
    list_sessions: (a) => (SESIONES[a?.project] ?? []).map((s) => fila(s, a.project)),
    list_live_sessions: (a) => (SESIONES[a?.project] ?? []).map((s) => fila(s, a.project)),
    // **Los encargados del material del proyecto**, que es lo que llena la
    // sección «Agentes» de cada carpeta. Un proyecto sin material declarado
    // devuelve la lista vacía, no un error.
    list_encargados: (a) => ({ encargados: ENCARGADOS[a?.project] ?? [], rechazados: [] }),
    list_encargado_status: (a) => PRESENCIA[a?.project] ?? [],
    list_agent_profiles: (a) => PERFILES[a?.project] ?? {},
    // **El catálogo de la máquina**: los agentes propios (creados en la app,
    // con sus carpetas) y los que declara el repositorio. Lo leen la
    // apariencia y Configuración › Agentes.
    list_machine_agents: {
      own: Object.entries(ENCARGADOS).flatMap(([project, lista]) =>
        lista.filter((e) => e.own).map((e) => ({
          agent: e, profile: PERFILES[project]?.[e.name] ?? perfil(null, null, null, null),
          folders: [project], all_folders: false, blocked: [], catalog_taken: null,
        })),
      ),
      repository: Object.entries(ENCARGADOS).flatMap(([project, lista]) =>
        lista.filter((e) => !e.own).map((e) => ({
          agent: e, profile: PERFILES[project]?.[e.name] ?? perfil(null, null, null, null), folders: [project],
        })),
      ),
    },
    list_workspace_attention: [],
    quota_status: {},
    keep_awake_status: { mode: "off", active: false, supported: true },
    load_session: (a) => {
      const s = sesion(a?.id ?? a?.session) ?? filas()[0];
      return {
        id: s.id, agent: s.agent, sources: [], excluded_sources: [], model: s.model, effort: null,
        permission_mode: null, subagent: s.subagent ?? null, parent: s.parent ?? null,
        encargado: s.encargado ?? null, chat_de_agente: s.chat_de_agente === true, agent_thread: false,
        turns: TURNOS[s.id] ?? [],
      };
    },
    send_message: enviar,
    finish_task: (a) => {
      const s = sesion(a?.id ?? a?.session);
      if (s) { s.archived = true; FINALIZADAS.add(s.id); }
      return null;
    },
    set_task_archived: (a) => {
      const s = sesion(a?.id ?? a?.session);
      if (s) s.archived = a?.archived !== false;
      return null;
    },
    stop_turn: (a) => {
      const v = VIVAS.get(a?.session);
      if (v) { v.relojes.forEach(clearTimeout); VIVAS.delete(a.session); emitir("chat", { workspace: WS, session: a.session, kind: "done", text: "", meta: null, ok: null, request_id: null }); }
      return null;
    },
    list_active_turns: () => [...VIVAS.keys()],
    list_live_turns: () => [...VIVAS.entries()].map(([session, v]) => ({ session, workspace: WS, project: proyectoDe(session), started_at: v.desde })),
    // Lo que una tarea tiene esperando. Sin esto la app no pinta la caja de
    // escribir hasta que contesta un turno.
    pending_requests: { questions: [], permissions: [] },
    turn_authors: (a) => ({
      person: { kind: "person", name: "Ana Ballesteros", verified_by: null, account: null },
      agent: { kind: a?.agent ?? "claude", name: etiqueta(a?.agent ?? "claude"), verified_by: null, account: null },
    }),
    load_queue: [],
    queue_ready: false,
    session_folder: (a) => `/Users/demo/.terminus/tareas/${a?.session ?? a?.id ?? "tarea"}`,
    list_models: (a) => ({ agent: a?.agent ?? "claude", models: MODELOS[a?.agent ?? "claude"] ?? [], fallback: false }),
    // Las mismas superficies que declara la app (`surfaces.rs`): una por
    // agente, y dos para el que no pide cuenta.
    list_surfaces: AGENTES.flatMap((a) => (a.inferencia === "sin_pedir_nada"
      ? [[a.id, a.label, "de_pago"], [`${a.id}-gratuitos`, "Modelos Free", "gratuitos"]]
      : [[a.id, a.label, "todo"]]
    ).map(([id, label, catalogo]) => ({ id, agent: a.id, label, catalogo, usable: true, marca: null, porque: null }))),
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
    // Los dos pesos del catálogo real: uno descargado, el otro por bajar.
    list_local_models: [
      { id: "qwen3.5-4b", label: "Qwen3.5 4B", quant: "Q4_K_M", bytes: 2_740_937_888, state: "installed", on_disk: 2_740_937_888, verified: true, serving: false },
      { id: "qwen3.5-2b", label: "Qwen3.5 2B", quant: "Q4_K_M", bytes: 1_280_835_840, state: "missing", on_disk: 0, verified: true, serving: false },
    ],
    local_runtime: { label: "llama.cpp", path: "/Users/demo/.terminus/runtime/llama.cpp", remedy: null, source: "instalado por la app" },
    consent_text: [[], 0],
    list_known_mcp: [
      { id: "figma", grupo: "figma", clave: "figma", name: "Figma", via: { clave: "mcp.known.figma.via" }, requiere: { clave: "mcp.known.figma.requires" }, despues: { clave: "mcp.known.figma.after" }, conectado: false },
      { id: "atlassian", grupo: "atlassian", clave: "atlassian", name: "Atlassian", via: null, requiere: { clave: "mcp.known.atlassian.requires" }, despues: { clave: "mcp.known.atlassian.after" }, conectado: false },
    ],
    list_mcp_agents: AGENTES.filter((a) => CONECTADAS[a.id]).map((a) => ({ id: a.id, label: a.label, recibe: true, instalado: true })),
    list_integrations: { workspace: WS, plugins: [{ id: "libreoffice", installed: true, enabled: true, version: "25.8", bytes: 312_000_000, supported: true }] },
    list_skill_sources: { fuentes: [], rotas: [] },
    // Las skills y los comandos que ofrece la barra «/» del compositor. Las
    // skills son del gobierno del proyecto; los comandos, del CLI.
    list_skills: [
      { name: "gobernanza", description: "Cómo se documenta y se revisa el repositorio.", scope: "gobierno" },
      { name: "revisar-landing", description: "Repasa la landing contra lo que hace la app hoy.", scope: "proyecto" },
    ],
    list_commands: [
      { name: "resumen", description: "Resume la conversación en un párrafo." },
      { name: "revisar-cambios", description: "Revisa el árbol de trabajo antes de guardarlo." },
      { name: "documentar", description: "Escribe qué cambió, en una página." },
    ],
    list_ports: { tareas: [], externos: [], aviso: null },
    // El latido del servicio: la ventana lo sondea cada 250 ms y con esto
    // sabe que no se perdió ningún evento. Estático, sin caso «gap».
    service_poll: { cursor: 0, gap: false, replay: false, runtime: "demo", reset: false },
    save_queue: null,
    site_sweep: null,
    list_mcp_servers: [],
    agentsview_status: { installed: false, enabled: false },
    list_memory_entries: { entries: [], total: 0, index: { lines: 0, bytes: 0, line_limit: 200, byte_limit: 8000 } },
    list_language_packs: [],
    list_bundled_language_packs: [],
    list_session_git: () => Object.fromEntries(
      filas().map(({ id }) => {
        const g = gitDe(id);
        const conRemoto = g.kind === "branch" || g.kind === "detached";
        return [id, {
          kind: g.kind, kn: g.kn, branch: g.branch, alias: g.alias, head: g.head,
          repository: proyectoDe(id) ?? "", shared_with: null, pull: g.pull,
          pull_known: conRemoto, checked_at: Date.now(), stale: false,
          has_remote: conRemoto, merged_locally: g.pull?.state === "merged",
        }];
      }),
    ),
    kn_pending: { files: [], folder_updated: false },
    kn_cloud_state: (a) => ({ workspace: WS, project: a?.project ?? "", state: "idle", fetched: 0, failed: 0, remaining: 0, bytes_fetched: 0, bytes_remaining: 0, failure: null }),
    get_profile: { name: "" },
    get_project_directory: RAIZ,
    task_history: (a) => {
      const id = a?.session ?? a?.id;
      const g = gitDe(id);
      return {
        history: { archived: sesion(id)?.archived === true, events: [], recovery: null }, branch: g.branch, alias: g.alias,
        path: `${RAIZ}/${proyectoDe(id) ?? CON_ARBOL}`, available: !FINALIZADAS.has(id), owned: true, restorable: false, recreatable: false, incomplete: false,
      };
    },
    list_storage: {
      tareas: [{
        session: "landing", project: "terminus-landing", tarea: "Simplificar la landing", proyecto: "terminus-landing",
        bytes: 638_003_200, recuperable: 568_000_000,
        bloques: [{ rel: "node_modules", clase: "recuperable", bytes: 498_000_000 }, { rel: ".git", clase: "git", bytes: 42_000_000 }],
      }],
      archivadas: { cuantas: 2, bytes: 96_000_000, recuperable: 72_000_000 },
      bytes: 734_003_200, recuperable: 640_000_000, compartido: [], sueltos: [], medido_en: ahora, aviso: null,
    },
    // El material que se puede mencionar con «@»: los archivos reales de esta
    // landing, que son los que el árbol de la tarea enseña.
    list_mentions: {
      fuentes: Object.entries(D.archivos)
        .filter(([ruta, v]) => v.texto !== null && !ruta.startsWith("public/demo/"))
        .map(([ruta]) => ({ ruta, tipo: "archivo" })),
      truncado: false,
    },
    // Cada tarea que existe, para probar «@»: con rama, sin rama todavía
    // (`sin-rama`), con un pull request abierto y otro ya fusionado, y dos
    // carpetas de documentos (borrador y guardado).
    list_task_mentions: () => Object.entries(SESIONES).flatMap(([p, lista]) => lista.map((s) => {
      const g = gitDe(s.id);
      return {
        target: { kind: "task", projectId: p, sessionId: s.id }, title: s.title,
        projectName: PROYECTOS.find((x) => x.id === p)?.name ?? p,
        alias: g.alias ?? "", branch: g.branch ?? "", available: !FINALIZADAS.has(s.id), archived: s.archived === true, updatedAt: s.updated_at,
      };
    })),
    list_permission_modes: MODOS_DE_PERMISO,
    // Las ramas de la carpeta, para el selector de «Rama base predeterminada»
    // (`BaseBranchPicker`). Las locales y las del remoto, con su adelanto.
    project_base_branches: () => ({
      branches: [
        { reference: "refs/heads/main", name: "main", remote: false, commit: D.commit || "4293fc5", ahead: 0, behind: 0 },
        { reference: "refs/heads/dev", name: "dev", remote: false, commit: "e5a0c2b", ahead: 2, behind: 0 },
        { reference: "refs/remotes/origin/main", name: "origin/main", remote: true, commit: D.commit || "4293fc5", ahead: 0, behind: 3 },
      ],
      selected: "refs/heads/main",
      fetched_at: ahora,
    }),
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
    // El bloque de cambios de un turno pide su par de commits: si es de un
    // turno guardado, el diff sale de `CAMBIOS_GUARDADOS`; si no, de lo que
    // la tarea cambió en esta visita.
    tree_diff: (a) => {
      const guardado = CAMBIOS_GUARDADOS[`${a?.before}..${a?.after}`];
      if (!guardado) return { patch: parcheDe(a?.session, a?.path ?? a?.rel), retired: false };
      return {
        patch: guardado.filter(([ruta]) => !a.path || ruta === a.path).map(([ruta, antes, despues]) => parche(ruta, antes, despues)).join(""),
        retired: false,
      };
    },
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

  /* ---------------------------------------------- la tira de pestañas */
  // La app recuerda qué tareas tenía abiertas por workspace y escritorio
  // (`lib/tabs.ts`). Sembrarlo hace que la demo abra en la conversación de la
  // landing —como quien vuelve a la app— en vez de en la caja en blanco.
  try {
    const tira = {
      abiertas: [{ clase: "tarea", id: "landing", project: "terminus-landing", session: "landing", titulo: "Simplificar la landing" }],
      activa: "landing",
    };
    localStorage.setItem("harness.layout.pestanas.danil.producto", JSON.stringify(tira));
    localStorage.setItem("harness.layout.space.danil", JSON.stringify("producto"));
    localStorage.setItem("harness.layout.sidebar.colapsado", JSON.stringify(false));
  } catch {}

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
   * tareas y carpetas, mostrar/ocultar las columnas, navegar el árbol y sus
   * pestañas, cambiar de escritorio, escribir y enviar un mensaje, empezar una
   * tarea nueva —global o dentro de una carpeta—, elegir el proyecto de una
   * tarea nueva, el razonamiento y los permisos del turno, y Configuración en
   * modo lectura (sus secciones y el tema), elegir agente y modelo, y
   * finalizar, archivar o desarchivar una tarea. Todo lo demás —cuentas,
   * proveedores, instalar, borrar, crear un proyecto, crear un agente— no está
   * en la lista, y por eso no hace nada.
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

    // La fila de una carpeta: abrirla (el nombre) y plegarla (la flecha) es
    // mirar. Su menú de acciones se abre igual —mirar no toca—, y lo que hay
    // dentro cae en la regla de abajo: renombrar, borrar o añadir no están
    // guionados y se bloquean.
    if (control.closest("[data-folder-row]")) return true;

    // El encabezado «Tareas» de una carpeta: la lupa abre el buscador y el
    // botón de personas agrupa o desagrupa por agente. Las dos son vistas, no
    // datos: el simulador contesta la búsqueda igual y la lista se rearma.
    if (control.closest("[data-tasks-header]")) return true;

    // La fila de un encargado: hablar con él abre un borrador con su
    // criterio —misma llamada que «Nueva tarea», con el agente ya puesto—, y
    // su menú enseña el perfil. «Nuevo agente» sí crea, y se bloquea.
    if (control.closest("[data-sidebar-agents]")) {
      return control.textContent.trim() !== "Nuevo agente";
    }
    // Abrir el perfil de un agente es una vista: enseña sus instrucciones y su
    // modelo. Lo que se escribe dentro no está guionado y cae en la regla de
    // abajo.
    if (control.textContent.trim() === "Configuración del agente") return true;

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
    // Archivar y desarchivar, del menú de la tarea o de su historial: el
    // simulador los guarda, y la tarea cambia de lista.
    if (["Archivar tarea", "Desarchivar tarea"].includes((etiqueta || control.textContent).trim())) return true;
    // La tarjeta de lo que produjo un turno: abrirla es leer un archivo. Su
    // texto viene de varios `span` pegados —«Produjoinforme.md12 kB»—, así
    // que aquí no puede ir un espacio detrás.
    if (control.textContent.trim().startsWith("Produjo")) return true;

    if (control.getAttribute("role") === "tab") return true; // cambiar de vista, nunca de dato

    if (control.getAttribute("role") === "radio") {
      // El tema de la ventana y el esfuerzo del modelo: elegir no llama a
      // ningún proveedor, solo se pinta distinto.
      return ["Apariencia", "Tema"].includes(control.closest('[role="radiogroup"]')?.getAttribute("aria-label") ?? "");
    }
    // Las opciones de permisos: mismo trato que el tema, por el mismo motivo
    // — elegir aquí no llama a ningún proveedor.
    // Y las del selector de modelos: cualquier agente corre el mismo turno
    // guionado.
    if (control.getAttribute("role") === "option") {
      return ["Permisos", "Modelos"].includes(control.closest('[role="listbox"]')?.getAttribute("aria-label") ?? "");
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

  /**
   * **Y `scrollIntoView`, que era lo que de verdad movía la página.** Al
   * abrir una tarea, la tira de pestañas trae la nueva a la vista con
   * `scrollIntoView({ block: "nearest" })` — y el nativo desplaza TODOS los
   * contenedores hasta la raíz, incluida la landing que tiene al iframe. Con
   * la demo entera a la vista no se nota, porque «nearest» no tiene nada que
   * mover; con la demo a medio salir de pantalla, la página saltaba cientos de
   * pixeles. Aquí se hace lo mismo pero solo con los contenedores de este
   * documento: la pestaña se ve, la landing no se mueve.
   */
  const desplazable = (n) => {
    if (n === document.scrollingElement) return n.scrollHeight > n.clientHeight || n.scrollWidth > n.clientWidth;
    const cs = getComputedStyle(n);
    return (/(auto|scroll|overlay)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight)
      || (/(auto|scroll|overlay)/.test(cs.overflowX) && n.scrollWidth > n.clientWidth);
  };
  // Cuánto mover un eje para dejar [a0, a1] dentro de [b0, b1], con las
  // mismas reglas que el navegador para start, end, center y nearest.
  const cuanto = (a0, a1, b0, b1, modo) => {
    if (modo === "start") return a0 - b0;
    if (modo === "end") return a1 - b1;
    if (modo === "center") return (a0 + a1 - b0 - b1) / 2;
    if (a0 >= b0 && a1 <= b1) return 0;
    return (a0 < b0) === (a1 - a0 <= b1 - b0) ? a0 - b0 : a1 - b1;
  };
  function mostrarAqui(el, opciones) {
    const o = opciones === false ? { block: "end" } : opciones && typeof opciones === "object" ? opciones : {};
    const block = o.block ?? "start";
    const inline = o.inline ?? "nearest";
    const behavior = o.behavior === "smooth" ? "smooth" : "auto";
    for (let n = el.parentElement; n; n = n.parentElement) {
      if (!desplazable(n)) continue;
      const r = el.getBoundingClientRect();
      const raiz = n === document.scrollingElement;
      const c = raiz ? { top: 0, left: 0 } : n.getBoundingClientRect();
      const arriba = raiz ? 0 : c.top + n.clientTop;
      const izquierda = raiz ? 0 : c.left + n.clientLeft;
      const dy = cuanto(r.top, r.bottom, arriba, arriba + (raiz ? innerHeight : n.clientHeight), block);
      const dx = cuanto(r.left, r.right, izquierda, izquierda + (raiz ? innerWidth : n.clientWidth), inline);
      if (dx || dy) (raiz ? window : n).scrollBy({ top: dy, left: dx, behavior });
    }
  }
  Element.prototype.scrollIntoView = function (opciones) {
    mostrarAqui(this, opciones);
  };
  if (Element.prototype.scrollIntoViewIfNeeded) {
    Element.prototype.scrollIntoViewIfNeeded = function () {
      mostrarAqui(this, { block: "nearest", inline: "nearest" });
    };
  }
})();
