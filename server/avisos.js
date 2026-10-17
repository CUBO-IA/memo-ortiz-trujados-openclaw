// Avisos de la app hacia Sia (OpenClaw) vía webhook HTTP.
const HOOK_URL = process.env.OPENCLAW_HOOK_URL || "http://127.0.0.1:18789/hooks/agent";
const HOOK_TOKEN = process.env.OPENCLAW_HOOK_TOKEN || "";
const TELEGRAM_ID = process.env.TELEGRAM_ID_MEMO || "";

function textoAviso(tipo, datos) {
  if (tipo === "registro") {
    return "Se registró " + datos.nombre + " (avatar " + datos.avatar + "). Total: " + datos.total + " registrados, " + datos.vivos + " en vivo.";
  }
  if (tipo === "inicio") {
    return "Trujados arrancó con " + datos.total + " agentes.";
  }
  if (tipo === "fin") {
    const m = datos.marcador.map((x) => x.nombre + " " + x.puntos).join(", ");
    return "Terminó la partida de Trujados. Marcador: " + m + ". Avisale a Memo y esperá su decisión sobre el ganador.";
  }
  return "";
}

async function avisar(tipo, datos) {
  if (!HOOK_TOKEN) {
    console.log("[avisos] (sin hook) " + textoAviso(tipo, datos));
    return;
  }
  const body = {
    message: textoAviso(tipo, datos),
    name: "trujados-" + tipo,
    agentId: "main",
    deliver: true,
    channel: "telegram",
    to: TELEGRAM_ID,
  };
  try {
    const res = await fetch(HOOK_URL, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + HOOK_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.error("[avisos] hook respondió " + res.status);
  } catch (e) {
    console.error("[avisos] error de hook: " + e.message);
  }
}

module.exports = { avisar };
