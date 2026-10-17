// Servidor de Trujados: Express + Socket.IO + rutas HTTP + puente con el motor.
require("dotenv").config();
const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { crearJuego } = require("./juego");
const agentesAI = require("./agentes");
const juezAI = require("./juez");
const { avisar } = require("./avisos");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "web")));

const TOKEN = process.env.TRUJADOS_TOKEN || "cambia-este-token";

function requiereToken(req, res, next) {
  if (req.get("x-trujados-token") === TOKEN) return next();
  res.status(401).json({ ok: false, error: "token inválido" });
}

const juego = crearJuego({
  agentesAI,
  juezAI,
  avisar,
  onEvento: (tipo, datos) => io.emit(tipo, datos),
  config: {
    duracion: Number(process.env.DURACION_SEGUNDOS) || 120,
    cuenta: Number(process.env.CUENTA_REGRESIVA) || 30,
  },
});

// Rutas públicas (lobby)
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "..", "web", "index.html")));
app.get("/pantalla", (req, res) => res.sendFile(path.join(__dirname, "..", "web", "pantalla.html")));
app.post("/api/agentes", (req, res) => {
  const r = juego.registrarAgente(req.body || {});
  res.status(r.ok ? 200 : 400).json(r);
});
app.get("/api/estado", (req, res) => res.json(juego.estado()));

// Rutas de control (solo el MCP de Sia, con token)
app.post("/api/partida/iniciar", requiereToken, (req, res) => res.json(juego.iniciar()));
app.post("/api/partida/puntos", requiereToken, (req, res) => {
  const { agenteId, nombre, puntos } = req.body || {};
  const r = juego.darPuntos(nombre || agenteId, puntos);
  res.status(r.ok ? 200 : 400).json(r);
});
app.post("/api/partida/ganador", requiereToken, (req, res) => {
  const { agenteId, nombre } = req.body || {};
  const r = juego.declararGanador(nombre || agenteId);
  res.status(r.ok ? 200 : 400).json(r);
});
app.post("/api/partida/reiniciar", requiereToken, (req, res) => res.json(juego.reiniciar()));

// Tiempo real: al conectar, mandar el estado completo
io.on("connection", (socket) => {
  socket.emit("estado", juego.estadoPublico());
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log("Trujados escuchando en http://0.0.0.0:" + PORT);
  console.log("Lobby: /  ·  Pantalla: /pantalla");
});
