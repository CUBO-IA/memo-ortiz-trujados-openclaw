// El juez: revisa cada pregunta antes de jugarla.
const fs = require("fs");
const path = require("path");

const PROMPT_DIR = path.join(__dirname, "prompts");
const API_URL = "https://api.deepseek.com/chat/completions";
const MODELO_JUEZ = process.env.MODELO_JUEZ || "deepseek-v4-pro";

function render(tpl, vars) {
  let s = tpl;
  for (const [k, v] of Object.entries(vars)) s = s.split("{{" + k + "}}").join(String(v));
  return s;
}

async function revisar(categoria, pregunta) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    // sin llave: aprobamos la pregunta de prueba si las opciones son distintas
    const vals = Object.values(pregunta.opciones || {});
    const ok = vals.length === 4 && new Set(vals).size === 4 && pregunta.correcta;
    return ok ? { aprobada: true } : { aprobada: false, motivo: "opciones inválidas" };
  }
  const tpl = fs.readFileSync(path.join(PROMPT_DIR, "juez.md"), "utf8");
  const prompt = render(tpl, {
    categoria, pregunta: pregunta.pregunta,
    A: pregunta.opciones.A, B: pregunta.opciones.B, C: pregunta.opciones.C, D: pregunta.opciones.D,
    correcta: pregunta.correcta,
  });
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({ model: MODELO_JUEZ, messages: [{ role: "user", content: prompt }], temperature: 0 }),
      signal: ctrl.signal,
    });
    if (!res.ok) return { aprobada: true }; // si el juez falla, no bloquear la partida
    const data = await res.json();
    const texto = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
    if (/^APROBADA/i.test(texto.trim())) return { aprobada: true };
    const m = texto.match(/RECHAZADAs*:?s*(.*)/i);
    return { aprobada: false, motivo: (m && m[1]) || "rechazada" };
  } catch (e) {
    return { aprobada: true };
  } finally {
    clearTimeout(t);
  }
}

module.exports = { revisar };
