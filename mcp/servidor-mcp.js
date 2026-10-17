// Servidor MCP de Trujados: herramientas que Sia (OpenClaw) usa para controlar el juego.
require("dotenv").config();
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");

const API = process.env.TRUJADOS_API_URL || "http://127.0.0.1:3000";
const TOKEN = process.env.TRUJADOS_TOKEN || "cambia-este-token";

async function llamar(ruta, metodo = "GET", body = null) {
  const res = await fetch(API + ruta, {
    method: metodo,
    headers: {
      "x-trujados-token": TOKEN,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || ("HTTP " + res.status));
  return data;
}

const server = new McpServer({ name: "trujados", version: "0.1.0" });

server.tool(
  "trujados_estado",
  "Devuelve cuántos agentes hay, cuáles están en vivo, el estado de la partida y el marcador.",
  {},
  async () => {
    const d = await llamar("/api/estado");
    return { content: [{ type: "text", text: JSON.stringify(d, null, 2) }] };
  }
);

server.tool(
  "trujados_iniciar",
  "Arranca la cuenta regresiva y comienza el juego.",
  {},
  async () => {
    const d = await llamar("/api/partida/iniciar", "POST");
    return { content: [{ type: "text", text: JSON.stringify(d) }] };
  }
);

server.tool(
  "trujados_dar_puntos",
  "Suma puntos a un agente por nombre.",
  { nombre: z.string(), puntos: z.number() },
  async (args) => {
    const d = await llamar("/api/partida/puntos", "POST", { nombre: args.nombre, puntos: args.puntos });
    return { content: [{ type: "text", text: JSON.stringify(d) }] };
  }
);

server.tool(
  "trujados_ganador",
  "Declara ganador a un agente por nombre y muestra el trofeo.",
  { nombre: z.string() },
  async (args) => {
    const d = await llamar("/api/partida/ganador", "POST", { nombre: args.nombre });
    return { content: [{ type: "text", text: JSON.stringify(d) }] };
  }
);

server.tool(
  "trujados_reiniciar",
  "Reinicia la partida y vuelve al lobby.",
  {},
  async () => {
    const d = await llamar("/api/partida/reiniciar", "POST");
    return { content: [{ type: "text", text: JSON.stringify(d) }] };
  }
);

server.tool(
  "trujados_volver_home",
  "Redirige a todas las pantallas a la página de inicio (lobby).",
  {},
  async () => {
    const d = await llamar("/api/partida/home", "POST");
    return { content: [{ type: "text", text: JSON.stringify(d) }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
main().catch((e) => { console.error(e); process.exit(1); });
