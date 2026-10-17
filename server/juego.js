// Motor del juego: estados, rondas, reloj y puntos (todo en memoria).
const CATEGORIAS = ["Ciencia", "Historia", "Geografía", "Arte", "Deportes", "Entretenimiento"];

function crearJuego({ agentesAI, juezAI, avisar, onEvento, config }) {
  const agentes = [];   // jugadores registrados
  const juego = {
    estado: "lobby",    // lobby | cuenta | jugando | esperando | final
    segundosRestantes: 0,
    ronda: 0,
    categoriaActual: null,
    preguntaActual: null,
    respuestas: {},
    historial: [],
    ganador: null,
  };

  let turno = 0;
  let relojInterval = null;
  let cuentaInterval = null;
  let rondaEnCurso = false;
  let detener = false;

  const duracion = (config && config.duracion) || 120;
  const cuenta = (config && config.cuenta) || 30;

  function emitir(tipo, datos) {
    if (onEvento) onEvento(tipo, datos);
  }

  function estadoPublico() {
    return {
      estado: juego.estado,
      segundosRestantes: juego.segundosRestantes,
      ronda: juego.ronda,
      categoriaActual: juego.categoriaActual,
      preguntaActual: juego.preguntaActual,
      respuestas: juego.respuestas,
      historial: juego.historial,
      ganador: juego.ganador,
      agentes: agentes.map((a) => ({ ...a })),
      marcador: marcador(),
    };
  }

  function marcador() {
    return agentes
      .map((a) => ({ id: a.id, nombre: a.nombre, puntos: a.puntos }))
      .sort((a, b) => b.puntos - a.puntos);
  }

  function porNombre(nombre) {
    return agentes.find((a) => a.nombre.toLowerCase() === String(nombre).toLowerCase());
  }

  function registrarAgente(datos) {
    if (agentes.length >= 12) return { ok: false, error: "Máximo 12 agentes" };
    if (juego.estado !== "lobby") return { ok: false, error: "La partida ya arrancó" };
    const personalidad = String(datos.personalidad || "").slice(0, 140);
    const agente = {
      id: "a" + (agentes.length + 1) + "_" + Math.random().toString(36).slice(2, 7),
      nombre: String(datos.nombre || "Agente").slice(0, 30),
      avatar: Math.min(7, Math.max(0, parseInt(datos.avatar, 10) || 0)),
      personalidad,
      especialidad: CATEGORIAS.includes(datos.especialidad) ? datos.especialidad : "Ciencia",
      puntoDebil: CATEGORIAS.includes(datos.puntoDebil) ? datos.puntoDebil : "Deportes",
      conectado: true,
      puntos: 0,
      x: 120 + Math.random() * 200,
      y: 120 + Math.random() * 150,
    };
    agentes.push(agente);
    emitir("agente:nuevo", agente);
    emitir("estado", estadoPublico());
    if (avisar) {
      avisar("registro", { nombre: agente.nombre, avatar: agente.avatar, total: agentes.length, vivos: agentes.filter((a) => a.conectado).length });
    }
    return { ok: true, agente };
  }

  function iniciar() {
    if (juego.estado !== "lobby") return { ok: false, error: "Ya está en curso" };
    if (agentes.length < 2) return { ok: false, error: "Mínimo 2 agentes" };
    juego.estado = "cuenta";
    juego.segundosRestantes = cuenta;
    emitir("estado", estadoPublico());
    let seg = cuenta;
    emitir("cuenta", { segundos: seg });
    cuentaInterval = setInterval(() => {
      seg -= 1;
      emitir("cuenta", { segundos: seg });
      if (seg <= 0) {
        clearInterval(cuentaInterval);
        comenzarJuego();
      }
    }, 1000);
    if (avisar) avisar("inicio", { total: agentes.length });
    return { ok: true };
  }

  function comenzarJuego() {
    juego.estado = "jugando";
    juego.segundosRestantes = duracion;
    emitir("estado", estadoPublico());
    relojInterval = setInterval(() => {
      juego.segundosRestantes -= 1;
      emitir("reloj", { segundosRestantes: juego.segundosRestantes });
      if (juego.segundosRestantes <= 0) {
        clearInterval(relojInterval);
        terminarPartida();
      }
    }, 1000);
    bucleRondas();
  }

  async function bucleRondas() {
    detener = false;
    while (!detener && juego.estado === "jugando") {
      await correrRonda();
      await esperar(3000); // pausa para que el público lea
    }
  }

  async function correrRonda() {
    if (detener || juego.estado !== "jugando") return;
    if (rondaEnCurso) return;
    rondaEnCurso = true;
    try {
      const vivos = agentes.filter((a) => a.conectado);
      if (vivos.length < 2) return;

      juego.ronda += 1;
      const categoria = CATEGORIAS[Math.floor(Math.random() * CATEGORIAS.length)];
      const preguntador = vivos[turno % vivos.length];
      turno += 1;
      juego.categoriaActual = categoria;
      emitir("ronda:categoria", { categoria, preguntador: preguntador.id });

      // 1) el preguntador crea la pregunta
      const pregunta = await agentesAI.preguntar(preguntador, categoria);
      if (!pregunta || detener) return;
      juego.preguntaActual = { ...pregunta, autor: preguntador.id, categoria };
      emitir("ronda:pregunta", juego.preguntaActual);

      // 2) el juez la revisa
      const fallo = await juezAI.revisar(categoria, pregunta);
      if (!fallo || !fallo.aprobada) {
        preguntador.puntos -= 1;
        juego.historial.push({ ronda: juego.ronda, categoria, resultado: "rechazada", motivo: fallo && fallo.motivo });
        emitir("ronda:resultado", { tipo: "rechazada", motivo: fallo && fallo.motivo, preguntador: preguntador.id });
        emitir("estado", estadoPublico());
        return;
      }

      // 3) todos los demás responden en paralelo
      const respondedores = vivos.filter((a) => a.id !== preguntador.id);
      const respuestas = await agentesAI.responderTodos(respondedores, categoria, pregunta);
      juego.respuestas = {};
      let correctos = 0;
      let totalRespondidos = 0;
      for (const a of respondedores) {
        const r = respuestas[a.id];
        if (!r) { continue; }
        juego.respuestas[a.id] = r;
        totalRespondidos += 1;
        emitir("ronda:respuesta", { agenteId: a.id, letra: r.respuesta, comentario: r.comentario });
        if (r.respuesta === pregunta.correcta) {
          a.puntos += 1;
          correctos += 1;
        }
      }

      // 4) puntuar al preguntador
      if (totalRespondidos > 0 && correctos === 0) {
        preguntador.puntos += 2; // nadie acertó
      }
      // si todos acertaron, +0 (muy fácil)

      juego.historial.push({ ronda: juego.ronda, categoria, resultado: "jugada", correctos, total: totalRespondidos });
      emitir("ronda:resultado", { tipo: "jugada", correcta: pregunta.correcta, correctos, total: totalRespondidos, preguntador: preguntador.id });
      emitir("estado", estadoPublico());
    } finally {
      rondaEnCurso = false;
    }
  }

  function terminarPartida() {
    detener = true;
    clearInterval(relojInterval);
    clearInterval(cuentaInterval);
    juego.estado = "esperando";
    emitir("estado", estadoPublico());
    emitir("esperando", { marcador: marcador() });
    if (avisar) {
      avisar("fin", { marcador: marcador() });
    }
  }

  function darPuntos(nombre, puntos) {
    const a = porNombre(nombre);
    if (!a) return { ok: false, error: "No encontré al agente " + nombre };
    a.puntos += Number(puntos) || 0;
    emitir("estado", estadoPublico());
    return { ok: true, marcador: marcador() };
  }

  function declararGanador(nombre) {
    const a = porNombre(nombre);
    if (!a) return { ok: false, error: "No encontré al agente " + nombre };
    juego.ganador = a.id;
    juego.estado = "final";
    emitir("ganador", { agenteId: a.id, nombre: a.nombre });
    emitir("estado", estadoPublico());
    return { ok: true, ganador: a.nombre };
  }

  function reiniciar() {
    clearInterval(relojInterval);
    clearInterval(cuentaInterval);
    detener = true;
    juego.estado = "lobby";
    juego.segundosRestantes = 0;
    juego.ronda = 0;
    juego.categoriaActual = null;
    juego.preguntaActual = null;
    juego.respuestas = {};
    juego.historial = [];
    juego.ganador = null;
    turno = 0;
    agentes.forEach((a) => { a.puntos = 0; });
    emitir("estado", estadoPublico());
    return { ok: true };
  }

  function estado() {
    return {
      estado: juego.estado,
      agentes: agentes.length,
      vivos: agentes.filter((a) => a.conectado).length,
      marcador: marcador(),
    };
  }

  function esperar(ms) { return new Promise((r) => setTimeout(r, ms)); }

  return {
    registrarAgente, iniciar, darPuntos, declararGanador, reiniciar,
    estado, estadoPublico, get agentes() { return agentes; }, get juego() { return juego; },
  };
}

module.exports = { crearJuego, CATEGORIAS };
