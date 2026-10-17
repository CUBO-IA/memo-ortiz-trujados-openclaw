// Conexión Socket.IO y estado compartido. El dibujo nunca llama al servidor.
(function () {
  const socket = io();
  const estado = {
    juego: { estado: "lobby" },
    agentes: [],
    pregunta: null,
    categoria: null,
    cuenta: null,
    reloj: null,
    ultimoResultado: null,
    ganador: null,
    globos: {},     // por agenteId: texto temporal
  };

  const oyentes = [];

  function publicar() {
    oyentes.forEach((fn) => fn(estado));
  }

  socket.on("estado", (d) => {
    Object.assign(estado, {
      juego: {
        estado: d.estado,
        segundosRestantes: d.segundosRestantes,
        ronda: d.ronda,
        ganador: d.ganador,
      },
      agentes: d.agentes || [],
    });
    if (d.preguntaActual) estado.pregunta = d.preguntaActual;
    if (d.categoriaActual) estado.categoria = d.categoriaActual;
    publicar();
  });
  socket.on("agente:nuevo", () => {});
  socket.on("cuenta", (d) => { estado.cuenta = d.segundos; publicar(); });
  socket.on("ronda:categoria", (d) => { estado.categoria = d.categoria; estado.globos = {}; publicar(); });
  socket.on("ronda:pregunta", (d) => { estado.pregunta = d; publicar(); });
  socket.on("ronda:respuesta", (d) => {
    const sel = d.respuesta ? d.letra + ") " + d.respuesta : d.letra;
    estado.globos[d.agenteId] = d.comentario ? sel + " — " + d.comentario : sel;
    publicar();
  });
  socket.on("ronda:resultado", (d) => { estado.ultimoResultado = d; publicar(); });
  socket.on("reloj", (d) => { estado.reloj = d.segundosRestantes; publicar(); });
  socket.on("esperando", (d) => { estado.esperando = d; publicar(); });
  socket.on("ganador", (d) => { estado.ganador = d; publicar(); });
  socket.on("redirigir", (d) => { if (d && d.a) window.location.href = d.a; });

  window.trujados = { socket, estado, suscribir(fn) { oyentes.push(fn); } };
})();
