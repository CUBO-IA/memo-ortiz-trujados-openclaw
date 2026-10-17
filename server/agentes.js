// Cerebro de los agentes: llamadas a DeepSeek para preguntar y responder.
// Si no hay DEEPSEEK_API_KEY, usa preguntas fijas de prueba para poder jugar igual.
const fs = require("fs");
const path = require("path");

const PROMPT_DIR = path.join(__dirname, "prompts");

function leerPrompt(nombre) {
  return fs.readFileSync(path.join(PROMPT_DIR, nombre), "utf8");
}

function render(tpl, vars) {
  let s = tpl;
  for (const [k, v] of Object.entries(vars)) {
    s = s.split("{{" + k + "}}").join(String(v));
  }
  return s;
}

// Preguntas fijas de reserva (modo sin llave / respaldo si DeepSeek falla).
const PREGUNTAS_FIJAS = [
  { categoria: "Ciencia", pregunta: "¿Cuál es el elemento químico del agua?", opciones: { A: "O2", B: "H2O", C: "CO2", D: "NaCl" }, correcta: "B" },
  { categoria: "Historia", pregunta: "¿En qué año terminó la Segunda Guerra Mundial?", opciones: { A: "1945", B: "1939", C: "1950", D: "1918" }, correcta: "A" },
  { categoria: "Geografía", pregunta: "¿Cuál es el río más largo del mundo?", opciones: { A: "Amazonas", B: "Nilo", C: "Misisipi", D: "Yangtsé" }, correcta: "B" },
  { categoria: "Arte", pregunta: "¿Quién pintó la Mona Lisa?", opciones: { A: "Picasso", B: "Da Vinci", C: "Van Gogh", D: "Dalí" }, correcta: "B" },
  { categoria: "Deportes", pregunta: "¿Cuántos jugadores tiene un equipo de fútbol en cancha?", opciones: { A: "9", B: "10", C: "11", D: "12" }, correcta: "C" },
  { categoria: "Entretenimiento", pregunta: "¿Quién creó a Mickey Mouse?", opciones: { A: "Walt Disney", B: "Stan Lee", C: "Matt Groening", D: "Hanna-Barbera" }, correcta: "A" },
];

const API_URL = "https://api.deepseek.com/chat/completions";
const MODELO_JUGADORES = process.env.MODELO_JUGADORES || "deepseek-v4-flash";

async function llamarDeepSeek(mensajes, maxMs = 8000) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), maxMs);
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + key,
      },
      body: JSON.stringify({
        model: MODELO_JUGADORES,
        messages: mensajes,
        temperature: 0.8,
        response_format: { type: "json_object" },
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : null;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function extraerJSON(texto) {
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch (e) {
    // intentar recortar a llaves
    const i = texto.indexOf("{");
    const j = texto.lastIndexOf("}");
    if (i >= 0 && j > i) {
      try { return JSON.parse(texto.slice(i, j + 1)); } catch (e2) { return null; }
    }
    return null;
  }
}

async function preguntar(agente, categoria) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    const fija = PREGUNTAS_FIJAS.find((p) => p.categoria === categoria) || PREGUNTAS_FIJAS[0];
    return { pregunta: fija.pregunta, opciones: fija.opciones, correcta: fija.correcta, comentario: "Pregunta de prueba (sin llave)" };
  }
  const tpl = leerPrompt("preguntador.md");
  const prompt = render(tpl, {
    nombre: agente.nombre, personalidad: agente.personalidad,
    especialidad: agente.especialidad, puntoDebil: agente.puntoDebil, categoria,
  });
  const texto = await llamarDeepSeek([{ role: "user", content: prompt }]);
  const j = extraerJSON(texto);
  if (j && j.pregunta && j.opciones && j.correcta) {
    return { pregunta: j.pregunta, opciones: j.opciones, correcta: j.correcta, comentario: j.comentario || "" };
  }
  const fija = PREGUNTAS_FIJAS.find((p) => p.categoria === categoria) || PREGUNTAS_FIJAS[0];
  return { pregunta: fija.pregunta, opciones: fija.opciones, correcta: fija.correcta, comentario: "Pregunta de respaldo" };
}

async function responder(agente, categoria, pregunta) {
  const key = process.env.DEEPSEEK_API_KEY;
  // punto débil aplicado en código: 50% de errar al azar
  if (categoria === agente.puntoDebil && Math.random() < 0.5) {
    const letras = ["A", "B", "C", "D"];
    const azar = letras[Math.floor(Math.random() * letras.length)];
    return { respuesta: azar, comentario: "Uf, esto no es lo mío…" };
  }
  if (!key) {
    // sin llave: responde correcto el 60% del tiempo
    const correcta = Math.random() < 0.6 ? pregunta.correcta : ["A", "B", "C", "D"][Math.floor(Math.random() * 4)];
    return { respuesta: correcta, comentario: "Creo que es la " + correcta };
  }
  const tpl = leerPrompt("respondedor.md");
  const prompt = render(tpl, {
    nombre: agente.nombre, personalidad: agente.personalidad,
    especialidad: agente.especialidad, puntoDebil: agente.puntoDebil,
    categoria, pregunta: pregunta.pregunta,
    A: pregunta.opciones.A, B: pregunta.opciones.B, C: pregunta.opciones.C, D: pregunta.opciones.D,
  });
  const texto = await llamarDeepSeek([{ role: "user", content: prompt }]);
  const j = extraerJSON(texto);
  if (j && j.respuesta) {
    return { respuesta: j.respuesta, comentario: j.comentario || "" };
  }
  return { respuesta: "A", comentario: "No entendí, digo A" };
}

async function responderTodos(respondedores, categoria, pregunta) {
  const out = {};
  await Promise.all(respondedores.map(async (a) => {
    const r = await responder(a, categoria, pregunta);
    if (r) out[a.id] = r;
  }));
  return out;
}

module.exports = { preguntar, responder, responderTodos };
