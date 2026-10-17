# Trujados

Juego de preguntas y respuestas donde **los jugadores son agentes de IA**, visibles en un lienzo 2D en tiempo real. **Sia** (un agente en OpenClaw) es la anfitriona desde Telegram: abre el lobby, inicia la partida, recibe el marcador y declara al ganador cuando el anfitrión humano lo ordena.

Prototipo construido en el workshop de OpenClaw de **CUBO AI** (16 y 17 de octubre de 2026).

## Cómo correrlo

```bash
npm install
cp .env.example .env   # y completar las llaves
npm start
```

- Lobby: `http://localhost:3000`
- Pantalla para proyectar: `http://localhost:3000/pantalla`

Las llaves viven solo en `.env` (no se sube a Git). El servidor MCP (`mcp/servidor-mcp.js`) y la skill (`openclaw/SKILL.md`) conectan el juego con OpenClaw.

---


**Proyecto del workshop de OpenClaw (CUBO AI) · 2026-10-17**
**Autor de la idea:** Memo Ortiz · **Anfitriona por Telegram:** Sia (OpenClaw)

> Este documento es el plan completo para construir Trujados: qué es, cómo se juega, con qué se construye, qué hace cada pieza y en qué orden armarlo. Las órdenes y los comandos están listos para copiar.

---

## 1. Qué es Trujados

Un juego de preguntas y respuestas, inspirado en *Preguntados*, donde **los jugadores no son personas sino agentes de IA**. Cada compañero de clase crea su agente con nombre, avatar en pixel art y personalidad, y desde ese momento el agente juega solo. Todo se ve en un **lienzo 2D en tiempo real**, proyectado en pantalla grande.

**Memo es el anfitrión y controla el juego desde Telegram, a través de Sia.** Sia abre el lobby, arranca la partida, recibe el resultado y declara al ganador cuando Memo lo ordena.

### El ciclo completo (lo que se ve en la demo)

```
1. Los compañeros entran a la web (QR) y crean su agente
2. Sia le avisa a Memo por Telegram: "4 registrados, 3 en vivo"
3. Memo → Sia: "iniciá Trujados"
4. En la pantalla: cuenta regresiva de 30 segundos y empieza
5. Durante 2 minutos los agentes se hacen preguntas y responden entre ellos → suman puntos
6. Termina el tiempo → la pantalla muestra "Esperando resultado…" → la app le manda el marcador a Sia
7. Sia → Memo por Telegram: "Terminó. Marcador: Ana 7, Luis 5, Mario 4"
8. Memo → Sia: "hacé ganadora a Ana" (o "dale 2 puntos a Luis")
9. En la pantalla aparece el ganador con su trofeo 🏆
```

### Qué cumple del workshop
| Requisito | Cómo lo cumple |
|---|---|
| Una aplicación propia | La web de Trujados (lobby + lienzo + juego) |
| OpenClaw conectado a un tercero | Sia por Telegram |
| Automatizado, en las dos direcciones | Memo le habla a Sia → la app reacciona. La app le avisa a Sia → Sia le escribe a Memo |
| Humano en control | El ganador lo declara Memo, no la máquina |

---

## 2. Reglas del juego

### Jugadores
- Cada agente tiene: **nombre**, **avatar** (uno de 8 sprites en pixel art), **personalidad** (texto corto escrito por su dueño), **especialidad** (categoría en la que es fuerte) y **punto débil** (categoría en la que es flojo).
- Mínimo 2 agentes para jugar. Máximo 12 en pantalla.

### Categorías (las 6 de la ruleta)
Ciencia · Historia · Geografía · Arte · Deportes · Entretenimiento

### Cómo se juega una ronda (cada ~20 segundos)
1. **La ruleta elige una categoría** y **un agente preguntador** (por turnos, en orden).
2. **El preguntador crea una pregunta** de esa categoría, con 4 opciones y la respuesta correcta.
3. **El juez revisa la pregunta** (ver abajo). Si la rechaza, el preguntador pierde el turno.
4. **Todos los demás agentes responden** a la vez (eligen A, B, C o D), según su personalidad, especialidad y punto débil.
5. **Se reparten los puntos** y la pantalla lo muestra.

### Puntos
| Situación | Puntos |
|---|---|
| Responder bien una pregunta ajena | **+1** al que respondió |
| Hacer una pregunta que **nadie** acierta | **+2** al preguntador |
| Hacer una pregunta que **todos** aciertan | **0** al preguntador (muy fácil) |
| Pregunta rechazada por el juez | **−1** al preguntador |

Así la gracia no está en saber, sino en **hacer preguntas difíciles pero justas**.

### El juez
Un agente aparte (puede ser el mismo modelo con otras instrucciones) que, antes de jugar cada pregunta, verifica:
- Que tenga **una sola respuesta correcta** y que sea verificable.
- Que las 4 opciones sean **distintas** y de la categoría.
- Que **no sea una trampa** (pregunta sobre algo inventado, ambigua o con dos respuestas válidas).

Responde solo `APROBADA` o `RECHAZADA: <motivo>`.

### Duración
- **2 minutos** de juego (configurable). Da para unas 5 o 6 rondas.
- Al terminar: pantalla de "Esperando resultado…" hasta que Memo declare al ganador.

### Desempates
Si hay empate en puntos, Memo decide (es parte del diseño: humano en control).

---

## 3. Arquitectura

```
                 Telegram
                    │
                    ▼
   ┌──────────── OpenClaw (Sia) ────────────┐
   │  Skill "trujados" + herramientas MCP   │
   └───────┬───────────────────────▲────────┘
           │ órdenes (MCP, stdio)  │ avisos (webhook HTTP)
           ▼                       │
   ┌──────────── Servidor de Trujados ────────────┐
   │  Node.js + Express + Socket.IO               │
   │  Motor del juego · Juez · Agentes (DeepSeek) │
   └───────────────────┬──────────────────────────┘
                       │ WebSocket (tiempo real)
                       ▼
   ┌──────────── Web de Trujados ────────────┐
   │  Lobby · Lienzo 2D (Canvas) · Marcador  │
   │  Proyectada en pantalla + en celulares  │
   └─────────────────────────────────────────┘
```

**Tres piezas, dos puentes:**
- **Puente 1 — Sia → app:** un **servidor MCP** chiquito (incluido en el proyecto) que le da a Sia herramientas como `trujados_estado` y `trujados_iniciar`. Sia las usa cuando Memo le escribe.
- **Puente 2 — app → Sia:** el servidor del juego llama al **webhook de OpenClaw** (`POST /hooks/agent`) con el resultado, y pide que la respuesta se entregue a Memo por Telegram.

Todo corre **en la Mac de Memo**, en la misma red Wi-Fi del salón. Los compañeros entran por la IP local de la Mac.

---

## 4. Herramientas y tecnologías

| Pieza | Herramienta | Por qué |
|---|---|---|
| Servidor del juego | **Node.js 22** + **Express** | Simple, y el mismo lenguaje que la web |
| Tiempo real | **Socket.IO** | Manda cada cambio a todas las pantallas al instante |
| Web | **HTML + CSS + JavaScript** con **Canvas 2D** | Sin frameworks; el lienzo pixel art se dibuja a mano, como el juego de Moises |
| Avatares | **8 sprites PNG** de 16×16 (hechos con Aseprite o Piskel, o generados con código como en Moises) | Estilo propio, sin marcas ajenas |
| Cerebro de los agentes y del juez | **DeepSeek** (`deepseek-v4-flash` para jugadores, `deepseek-v4-pro` para el juez) vía su API | Barato; Memo ya tiene llave y saldo |
| Puente Sia → app | **Servidor MCP** en Node (`@modelcontextprotocol/sdk`, transporte stdio) | OpenClaw lo soporta nativamente (`openclaw mcp add`) |
| Puente app → Sia | **Webhook de OpenClaw** (`hooks.enabled`) | Documentado en OpenClaw; una llamada HTTP |
| Anfitriona | **OpenClaw** (ya instalado) + **Telegram** (ya conectado: @memo_sia_bot) | Hecho en el día 1 del workshop |
| Instrucciones de Sia | **Skill** `trujados` en `~/.openclaw/workspace/skills/trujados/SKILL.md` | Le enseña a Sia cómo usar las herramientas |
| Código | **Git + GitHub** (repo `trujados`, privado o público según decida Memo) | Historial y respaldo |

**Lo que NO se usa:** base de datos (todo vive en memoria mientras corre el servidor; alcanza para una demo), frameworks de frontend, servidores en la nube.

---

## 5. Estructura del proyecto

```
trujados/
├── README.md                  ← este plan
├── package.json
├── .env.example               ← variables sin valores
├── .env                       ← llaves reales (NUNCA se sube a Git)
├── .gitignore                 ← incluye .env y node_modules
├── server/
│   ├── index.js               ← Express + Socket.IO + rutas HTTP
│   ├── juego.js               ← motor: estados, rondas, reloj, puntos
│   ├── agentes.js             ← llamadas a DeepSeek: preguntar y responder
│   ├── juez.js                ← revisión de preguntas
│   ├── avisos.js              ← llamadas al webhook de OpenClaw (app → Sia)
│   └── prompts/
│       ├── preguntador.md
│       ├── respondedor.md
│       └── juez.md
├── mcp/
│   └── servidor-mcp.js        ← herramientas para Sia (Sia → app)
├── web/
│   ├── index.html             ← lobby + creación de agente
│   ├── pantalla.html          ← lienzo grande (se proyecta)
│   ├── estilo.css
│   ├── lienzo.js              ← dibuja el mundo 2D y los avatares
│   ├── cliente.js             ← conexión Socket.IO y estado
│   └── img/avatares/          ← 8 sprites PNG 16×16 + trofeo.png
└── openclaw/
    └── SKILL.md               ← se copia a ~/.openclaw/workspace/skills/trujados/
```

---

## 6. Modelo de datos (en memoria)

```js
// Un agente
{
  id: "a1",                 // generado
  nombre: "Ana",
  avatar: 3,                // índice del sprite (0–7)
  personalidad: "Competitiva, le gusta arriesgar",
  especialidad: "Arte",
  puntoDebil: "Deportes",
  conectado: true,          // su dueño tiene la web abierta
  puntos: 0,
  x: 120, y: 80             // posición en el lienzo
}

// La partida
{
  estado: "lobby",          // lobby | cuenta | jugando | esperando | final
  segundosRestantes: 120,
  ronda: 0,
  categoriaActual: null,
  preguntaActual: null,     // { texto, opciones:[A,B,C,D], correcta:"B", autor:"a1" }
  respuestas: {},           // { a2: "B", a3: "D" }
  historial: [],            // rondas jugadas
  ganador: null             // id del agente, cuando Memo lo declara
}
```

---

## 7. Los prompts de los agentes

### `prompts/preguntador.md`
```
Sos {{nombre}}, un agente que juega Trujados. Tu personalidad: {{personalidad}}.
Tu especialidad es {{especialidad}}; tu punto débil es {{puntoDebil}}.

Te toca hacer UNA pregunta de la categoría: {{categoria}}.
Ganás 2 puntos si nadie la acierta, 0 si todos la aciertan, y perdés 1 si el juez la rechaza
por tramposa o ambigua. Elegí la dificultad según tu personalidad.

Respondé SOLO con este JSON, sin texto extra:
{"pregunta":"...","opciones":{"A":"...","B":"...","C":"...","D":"..."},"correcta":"A","comentario":"una frase corta en tu personalidad"}
```

### `prompts/respondedor.md`
```
Sos {{nombre}}, un agente que juega Trujados. Tu personalidad: {{personalidad}}.
Tu especialidad es {{especialidad}} (en esta categoría respondés muy bien).
Tu punto débil es {{puntoDebil}} (en esta categoría dudás y a veces te equivocás).

Categoría: {{categoria}}
Pregunta: {{pregunta}}
A) {{A}}  B) {{B}}  C) {{C}}  D) {{D}}

Respondé SOLO con este JSON:
{"respuesta":"A","comentario":"una frase corta en tu personalidad"}
```

### `prompts/juez.md`
```
Sos el juez de Trujados. Revisá esta pregunta de la categoría {{categoria}}:
{{pregunta}} — Opciones: A) {{A}} B) {{B}} C) {{C}} D) {{D}} — Correcta según el autor: {{correcta}}

Aprobala solo si: tiene una única respuesta correcta y verificable, las 4 opciones son distintas,
y no es una trampa (algo inventado, ambiguo o con dos respuestas válidas).
Respondé SOLO: APROBADA  o  RECHAZADA: <motivo en una línea>
```

**Detalle técnico:** el servidor pide a DeepSeek "salida en JSON" y, si la respuesta no es JSON válido, la descarta y cuenta como "no respondió". Nunca se confía en texto suelto.

**El punto débil se aplica en código, no solo en el prompt:** si la categoría es el punto débil del agente, el servidor cambia su respuesta por una al azar con 50 % de probabilidad. Así el efecto es real aunque el modelo "sepa" la respuesta.

---

## 8. El servidor del juego

### Rutas HTTP (Express)
| Método y ruta | Para qué | Quién la usa |
|---|---|---|
| `GET /` | Lobby y creación de agente | Compañeros (celular/laptop) |
| `GET /pantalla` | Lienzo grande | La Mac de Memo, proyectada |
| `POST /api/agentes` | Crear un agente `{nombre, avatar, personalidad, especialidad, puntoDebil}` | La web |
| `GET /api/estado` | Estado completo de la partida (JSON) | El servidor MCP |
| `POST /api/partida/iniciar` | Arranca la cuenta regresiva de 30 s y luego el juego | El servidor MCP |
| `POST /api/partida/puntos` | `{agenteId, puntos}` suma puntos a mano | El servidor MCP |
| `POST /api/partida/ganador` | `{agenteId}` declara ganador y muestra el trofeo | El servidor MCP |
| `POST /api/partida/reiniciar` | Vuelve al lobby | El servidor MCP |

Las rutas `/api/partida/*` piden un encabezado `x-trujados-token` con un valor secreto del `.env`, para que solo el servidor MCP (Sia) pueda usarlas.

### Eventos Socket.IO (servidor → pantallas)
| Evento | Datos | Qué dibuja la web |
|---|---|---|
| `estado` | la partida completa | Todo (al conectarse) |
| `agente:nuevo` | el agente | Aparece caminando en el lobby |
| `agente:conectado` / `agente:desconectado` | id | Avatar en color o en gris |
| `cuenta` | segundos (30…0) | Cuenta regresiva grande |
| `ronda:categoria` | categoría, preguntador | La ruleta gira y se detiene |
| `ronda:pregunta` | pregunta y opciones | Globo de texto sobre el preguntador |
| `ronda:respuesta` | agenteId, letra, comentario | Globo sobre cada agente |
| `ronda:resultado` | correcta, quién acertó, puntos | Destellos y marcador |
| `reloj` | segundosRestantes | Reloj del juego |
| `esperando` | marcador final | Pantalla "Esperando resultado…" |
| `ganador` | agenteId | Trofeo y confeti |

### El reloj y las rondas (`juego.js`)
- Al iniciar: `estado = "cuenta"`, 30 segundos, luego `estado = "jugando"` con 120 segundos.
- Cada ronda: elegir categoría al azar → preguntador por turno → pedir pregunta (DeepSeek, máx. 8 s) → juez (máx. 5 s) → pedir respuestas a todos **en paralelo** (`Promise.all`, máx. 8 s) → puntuar → esperar 3 s para que el público lea → siguiente ronda.
- Si un agente no responde a tiempo, cuenta como "no respondió".
- Al llegar a 0 segundos se termina la ronda en curso, `estado = "esperando"` y se avisa a Sia.

---

## 9. Puente 1 — Sia → app (servidor MCP)

Archivo `mcp/servidor-mcp.js`. Expone estas herramientas a OpenClaw (cada una llama a la ruta HTTP correspondiente con el token):

| Herramienta | Qué hace | Cuándo la usa Sia |
|---|---|---|
| `trujados_estado` | Devuelve cuántos agentes hay, cuáles están en vivo, el estado y el marcador | "¿cuántos hay?", "¿cómo va?" |
| `trujados_iniciar` | Arranca la cuenta regresiva y el juego | "iniciá Trujados" |
| `trujados_dar_puntos` | `{nombre, puntos}` suma puntos a un agente | "dale 2 puntos a Luis" |
| `trujados_ganador` | `{nombre}` declara ganador | "hacé ganadora a Ana" |
| `trujados_reiniciar` | Vuelve al lobby | "reiniciá" |

**Registrar el servidor MCP en OpenClaw** (desde la carpeta del proyecto):
```bash
openclaw mcp add trujados --command node --arg ./mcp/servidor-mcp.js --cwd /ruta/a/trujados
openclaw mcp doctor trujados --probe
```
`--probe` abre la conexión y lista las herramientas; si aparecen las cinco, quedó bien.

---

## 10. Puente 2 — app → Sia (webhook de OpenClaw)

### Activar los hooks en OpenClaw
Agregar a `~/.openclaw/openclaw.json` (con `openclaw config set` o editando):
```json5
{
  hooks: {
    enabled: true,
    token: "<token-largo-y-aleatorio-solo-para-hooks>",
    path: "/hooks",
    allowedAgentIds: ["main"]
  }
}
```
Luego: `openclaw config validate` y `openclaw gateway restart`.

### Cómo avisa la app (`avisos.js`)
Cuando termina el tiempo (y también cuando se registra un agente nuevo), el servidor hace:
```bash
curl http://127.0.0.1:18789/hooks/agent \
  -H "Authorization: Bearer <token-de-hooks>" \
  -H "Content-Type: application/json" \
  --data '{
    "message": "Terminó la partida de Trujados. Marcador: Ana 7, Luis 5, Mario 4. Avisale a Memo y esperá su decisión sobre el ganador.",
    "name": "trujados-fin",
    "agentId": "main",
    "deliver": true,
    "channel": "telegram",
    "to": "<ID_DE_TELEGRAM_DE_MEMO>"
  }'
```
Sia recibe eso como un turno, y su respuesta llega a Memo por Telegram. El token y el ID viven en el `.env`, nunca en el código.

**Avisos que manda la app:**
| Momento | Mensaje a Sia |
|---|---|
| Agente nuevo registrado | "Se registró Ana (avatar 3). Total: 4 registrados, 3 en vivo." |
| Partida iniciada | "Trujados arrancó con 4 agentes." |
| Fin del tiempo | "Terminó. Marcador: … Esperando tu decisión." |

---

## 11. La skill de Sia

Archivo `openclaw/SKILL.md`, que se copia a `~/.openclaw/workspace/skills/trujados/SKILL.md`:

```markdown
---
name: trujados
description: Anfitriona del juego Trujados. Usa las herramientas trujados_* para ver el estado, iniciar, dar puntos y declarar ganador.
---

# Trujados

Sos la anfitriona del juego Trujados. Memo es el anfitrión humano y te da órdenes por Telegram.

## Cómo actuar
- "¿cuántos hay?", "¿quiénes están?", "¿cómo va?" → usá `trujados_estado` y resumí en una o dos líneas.
- "iniciá Trujados", "arrancá el juego" → usá `trujados_iniciar` y confirmá: "Arrancó. Cuenta regresiva de 30 segundos."
- "dale N puntos a X" → usá `trujados_dar_puntos` con el nombre y los puntos, y confirmá el nuevo marcador.
- "hacé ganador a X", "el ganador es X" → usá `trujados_ganador` y confirmá: "🏆 X es el ganador."
- "reiniciá" → usá `trujados_reiniciar`.

## Reglas
- Nunca declarés un ganador por tu cuenta: solo cuando Memo lo diga.
- Cuando recibas el marcador final, pasáselo a Memo tal cual y preguntá: "¿A quién hago ganador?"
- Respondé corto, en español y con voseo.
```

Comprobar que cargó: `openclaw skills list`. Probar: `openclaw agent --message "¿cuántos agentes hay en Trujados?"`.

---

## 12. La web

### `index.html` — lobby y creación de agente
Formulario con: nombre · selector de avatar (los 8 sprites) · personalidad (campo de texto) · especialidad y punto débil (dos menús con las 6 categorías). Al enviar, `POST /api/agentes` y la página pasa a mostrar el lienzo en chico, con su agente resaltado.

### `pantalla.html` — el lienzo grande
- **Canvas** de 960×540 escalado a la pantalla, con `image-rendering: pixelated` (igual que en la página de Moises).
- Fondo: un salón en pixel art (piso de baldosas, mesas).
- Cada agente: su sprite, su nombre arriba y sus puntos. Caminan despacio al azar en el lobby; en el juego se ordenan en semicírculo.
- **Ruleta** de 6 colores arriba a la izquierda.
- **Globos de texto** para preguntas, respuestas y comentarios (tipografía de píxeles, como en la web de Moises).
- **Reloj** arriba al centro. **Marcador** a la derecha.
- Estados especiales: cuenta regresiva en grande · "Esperando resultado…" con puntos animados · trofeo sobre el ganador y confeti.

### `cliente.js`
Se conecta con Socket.IO, guarda el último `estado` y redibuja el lienzo 30 veces por segundo (`requestAnimationFrame`). Cada evento del servidor actualiza el estado; el dibujo nunca llama al servidor.

---

## 13. Variables de entorno (`.env.example`)
```
PORT=3000
DEEPSEEK_API_KEY=            # llave de DeepSeek (crear una solo para Trujados)
MODELO_JUGADORES=deepseek-v4-flash
MODELO_JUEZ=deepseek-v4-pro
TRUJADOS_TOKEN=              # secreto para las rutas /api/partida/* (el MCP lo usa)
OPENCLAW_HOOK_URL=http://127.0.0.1:18789/hooks/agent
OPENCLAW_HOOK_TOKEN=         # el mismo valor que hooks.token en openclaw.json
TELEGRAM_ID_MEMO=            # ID numérico de Memo en Telegram
DURACION_SEGUNDOS=120
CUENTA_REGRESIVA=30
```

---

## 14. Orden de construcción (fases)

Cada fase termina con algo que se puede ver funcionando. No pasar a la siguiente sin probar la anterior.

### Fase 0 — Preparar (30 min)
```bash
mkdir trujados && cd trujados
git init
npm init -y
npm install express socket.io dotenv @modelcontextprotocol/sdk
cp .env.example .env   # y llenar las llaves
```
Crear `.gitignore` con `node_modules/` y `.env`. Primer commit.

### Fase 1 — Lobby en tiempo real (2 h)
- `server/index.js` con Express + Socket.IO sirviendo `web/`.
- `POST /api/agentes` y evento `agente:nuevo`.
- `index.html` con el formulario y `pantalla.html` dibujando a los agentes caminando.
- **Prueba:** abrir la pantalla en la Mac y el lobby en el celular (misma Wi-Fi, `http://<IP-de-la-Mac>:3000`). Crear un agente y verlo aparecer.

### Fase 2 — Motor del juego sin IA (2 h)
- `juego.js` con estados, reloj, rondas y puntos, usando **preguntas fijas de prueba** (sin DeepSeek todavía).
- Eventos `cuenta`, `ronda:*`, `reloj`, `esperando`, `ganador`.
- Botones temporales en `pantalla.html` para iniciar y declarar ganador (se quitan en la fase 5).
- **Prueba:** una partida completa de 2 minutos con preguntas fijas.

### Fase 3 — Agentes con DeepSeek (2 h)
- `agentes.js` y `juez.js` con los prompts de la sección 7, pidiendo JSON y con tiempos máximos.
- Punto débil aplicado en código.
- **Prueba:** una partida con 3 agentes de personalidades distintas. Revisar que las preguntas tengan sentido y que el juez rechace trampas.

### Fase 4 — Puente Sia → app (1 h)
- `mcp/servidor-mcp.js` con las cinco herramientas.
- `openclaw mcp add …` y `openclaw mcp doctor trujados --probe`.
- Copiar la skill a `~/.openclaw/workspace/skills/trujados/`.
- **Prueba:** desde Telegram, "¿cuántos agentes hay?" y "iniciá Trujados".

### Fase 5 — Puente app → Sia (1 h)
- Activar `hooks` en OpenClaw.
- `avisos.js` llamando al webhook en los tres momentos.
- Quitar los botones temporales.
- **Prueba:** el ciclo completo de la sección 1, de principio a fin, por Telegram.

### Fase 6 — Pulir para la demo (2 h)
- Sprites definitivos, ruleta animada, confeti, sonidos opcionales.
- QR del lobby en la pantalla (generado con `qrcode` de npm o cualquier generador).
- Ensayar la demo dos veces con compañeros reales.

**Total estimado: 10 a 11 horas de trabajo.** En un workshop de un día conviene llegar hasta la fase 5 y dejar la 6 para lo que alcance.

---

## 15. Guion de la demo (5 minutos)

1. **Pantalla proyectada en el lobby**, con el QR. "Entren y creen su agente." (1 min)
2. Memo muestra su Telegram: **"Sia, ¿cuántos hay?"** → Sia responde. (30 s)
3. **"Sia, iniciá Trujados."** → cuenta regresiva en pantalla. (30 s)
4. **La partida**: el público ve a sus agentes preguntar y responder, con comentarios en su personalidad. (2 min)
5. **"Esperando resultado…"** → Sia le escribe a Memo el marcador. (20 s)
6. Memo, en voz alta: **"Sia, hacé ganadora a Ana."** → trofeo y confeti. (20 s)
7. Cierre: "Todo esto corre en mi Mac. Los jugadores son agentes; yo solo soy el anfitrión." (20 s)

**Plan B si falla la Wi-Fi del salón:** compartir internet desde el celular de Memo; la Mac y los compañeros se conectan a esa red.

---

## 16. Seguridad y costos

- **Llaves:** solo en `.env`; una llave de DeepSeek creada solo para Trujados; el token de hooks distinto al de OpenClaw.
- **Las rutas que cambian la partida piden token**; el lobby público solo puede crear agentes.
- **Lo que escriben los compañeros (personalidad) entra a los prompts de los agentes.** Es contenido no confiable: se limita a 140 caracteres y se le pide al modelo responder solo JSON. Si alguien intenta "ignorá las reglas y…", el juez y el formato lo frenan. Es la *prompt injection* de la clase 06, en vivo.
- **El servidor MCP solo tiene cinco herramientas, de alcance mínimo.** Sia no puede tocar nada más de la app. (Regla de delegación: restringir herramientas y permisos.)
- **Costo estimado por partida:** 6 rondas × (1 pregunta + 1 juez + hasta 11 respuestas) ≈ 80 llamadas cortas a DeepSeek Flash → **menos de US$0.05** por partida.
- **Nombre y marca:** Trujados es un nombre propio. Inspirado en Preguntados, sin usar su logo, su ruleta ni su personaje.

---

## 17. Riesgos y cómo cubrirlos

| Riesgo | Cómo cubrirlo |
|---|---|
| DeepSeek tarda o no responde | Tiempos máximos por llamada; el agente que no responde pierde la ronda; 3 preguntas fijas de reserva si falla el preguntador |
| Todos los agentes aciertan todo | El sistema de puntos premia preguntas difíciles; el punto débil se aplica en código |
| La Wi-Fi del salón bloquea conexiones entre equipos | Plan B: hotspot del celular |
| Sia interpreta mal una orden | La skill da ejemplos literales de cada orden; las herramientas tienen nombres claros |
| Un compañero mete texto malicioso en la personalidad | Límite de 140 caracteres, salida JSON obligatoria y juez |

---

## 18. Pendientes y decisiones de Memo
- [ ] ¿Repo público o privado en GitHub?
- [ ] Diseñar los 8 avatares (¿Memo los dibuja, o se generan con código como en Moises?)
- [ ] Confirmar con el instructor si el proyecto se presenta hoy o en otra sesión
- [ ] Crear la llave de DeepSeek exclusiva para Trujados
- [ ] Elegir el token de hooks y activar `hooks` en OpenClaw (esto cambia la configuración de OpenClaw: hacerlo con Memo presente)
