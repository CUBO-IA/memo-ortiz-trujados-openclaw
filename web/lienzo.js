// Lienzo 2D: dibuja el mundo de Trujados con Canvas, en pixel art procedural.
(function () {
  const canvas = document.getElementById("lienzo");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = 960, H = 540;
  canvas.width = W; canvas.height = H;
  ctx.imageSmoothingEnabled = false;

  const PALETA = ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6", "#e67e22", "#1abc9c", "#e84393"];
  const COLORES_CAT = {
    Ciencia: "#3498db", Historia: "#e67e22", Geografía: "#2ecc71",
    Arte: "#e84393", Deportes: "#f1c40f", Entretenimiento: "#9b59b6",
  };

  // sprites procedurales de 16x16 (8 variantes por color)
  function dibujarSprite(c, x, y, s, variante) {
    ctx.fillStyle = c;
    ctx.fillRect(x, y + s * 0.15, s, s * 0.7);         // cuerpo
    ctx.fillRect(x + s * 0.3, y, s * 0.4, s * 0.2);    // cabeza
    ctx.fillStyle = "#fff";
    ctx.fillRect(x + s * 0.35, y + s * 0.28, s * 0.3, s * 0.12); // ojos
    // variantes: sombrero / gorro
    if (variante % 2 === 0) {
      ctx.fillStyle = "#222";
      ctx.fillRect(x + s * 0.25, y, s * 0.5, s * 0.08);
    } else {
      ctx.fillStyle = "#f5f5dc";
      ctx.fillRect(x + s * 0.3, y - s * 0.06, s * 0.4, s * 0.08);
    }
  }

  function dibujarFondo() {
    ctx.fillStyle = "#12132a";
    ctx.fillRect(0, 0, W, H);
    // piso de baldosas
    ctx.fillStyle = "#1a1c3a";
    for (let i = 0; i < W; i += 40) {
      for (let j = 0; j < H; j += 40) {
        if ((i / 40 + j / 40) % 2 === 0) ctx.fillRect(i, j, 40, 40);
      }
    }
    // mesas
    ctx.fillStyle = "#3a2d1f";
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(80 + i * 300, 380, 120, 60);
      ctx.fillRect(80 + i * 300 + 10, 360, 100, 20);
    }
  }

  function dibujarRuleta(estado) {
    const cx = 90, cy = 70, r = 48;
    const cats = Object.keys(COLORES_CAT);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = "#0b0c1c";
    ctx.beginPath(); ctx.arc(0, 0, r + 6, 0, Math.PI * 2); ctx.fill();
    cats.forEach((c, i) => {
      const a0 = (i / cats.length) * Math.PI * 2;
      const a1 = ((i + 1) / cats.length) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, a0, a1);
      ctx.fillStyle = COLORES_CAT[c];
      ctx.fill();
    });
    // flecha
    ctx.fillStyle = "#fff";
    ctx.fillRect(r - 4, -8, 14, 16);
    ctx.restore();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "center";
    ctx.fillText(estado.categoria || "", cx, cy + r + 20);
  }

  function dibujarMarcador(estado) {
    const xs = W - 150;
    ctx.fillStyle = "#0b0c1c";
    ctx.fillRect(xs - 10, 20, 160, 20 + estado.agentes.length * 24);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "left";
    ctx.fillText("MARCADOR", xs, 40);
    estado.agentes.slice().sort((a, b) => b.puntos - a.puntos).forEach((a, i) => {
      ctx.fillStyle = PALETA[a.avatar % PALETA.length];
      ctx.fillText((i + 1) + ". " + a.nombre, xs, 62 + i * 24);
      ctx.fillStyle = "#fff";
      ctx.fillText(String(a.puntos), xs + 130, 62 + i * 24);
    });
  }

  function dibujarAgente(a, estado) {
    const c = PALETA[a.avatar % PALETA.length];
    const desconectado = estado.juego.estado !== "lobby" && !a.conectado;
    ctx.save();
    if (desconectado) ctx.globalAlpha = 0.35;
    dibujarSprite(c, a.x - 24, a.y - 32, 48, a.avatar);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(a.nombre, a.x, a.y + 34);
    ctx.fillStyle = "#f1c40f";
    ctx.fillText(a.puntos + " pts", a.x, a.y + 48);
    ctx.restore();
  }

  function dibujarGlobo(agente, texto, estado) {
    ctx.save();
    ctx.font = "12px monospace";
    const maxW = 200;
    const lineas = texto.length > 40 ? [texto.slice(0, 40), texto.slice(40, 80)] : [texto];
    const w = Math.min(maxW, Math.max(...lineas.map((l) => l.length)) * 7 + 16);
    const h = lineas.length * 16 + 12;
    const bx = agente.x - w / 2, by = agente.y - 70 - h;
    ctx.fillStyle = "#fff";
    ctx.fillRect(bx, by, w, h);
    ctx.fillStyle = "#111";
    ctx.textAlign = "left";
    lineas.forEach((l, i) => ctx.fillText(l, bx + 8, by + 18 + i * 16));
    // pico
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(agente.x - 6, by + h); ctx.lineTo(agente.x + 6, by + h); ctx.lineTo(agente.x, by + h + 10);
    ctx.fill();
    ctx.restore();
  }

  function dibujarReloj(estado) {
    const t = estado.reloj != null ? estado.reloj : (estado.juego.segundosRestantes || 0);
    ctx.fillStyle = "#0b0c1c";
    ctx.fillRect(W / 2 - 40, 20, 80, 34);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 20px monospace";
    ctx.textAlign = "center";
    const mm = Math.floor(t / 60), ss = String(t % 60).padStart(2, "0");
    ctx.fillText(mm + ":" + ss, W / 2, 46);
  }

  function dibujarCuenta(estado) {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 90px monospace";
    ctx.textAlign = "center";
    ctx.fillText(String(estado.cuenta), W / 2, H / 2 + 20);
    ctx.font = "20px monospace";
    ctx.fillText("Preparate…", W / 2, H / 2 + 70);
  }

  function dibujarEsperando(estado) {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 40px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Esperando resultado…", W / 2, H / 2 - 20);
    const pts = ".".repeat((Math.floor(Date.now() / 400) % 4));
    ctx.fillText(pts, W / 2, H / 2 + 30);
  }

  function dibujarGanador(estado) {
    const a = estado.agentes.find((x) => x.id === estado.juego.ganador);
    if (!a) return;
    // confeti
    for (let i = 0; i < 60; i++) {
      const x = (Math.sin(Date.now() / 300 + i) * 0.5 + 0.5) * W;
      const y = (Math.cos(Date.now() / 260 + i * 1.7) * 0.5 + 0.5) * H;
      ctx.fillStyle = PALETA[i % PALETA.length];
      ctx.fillRect(x, y, 8, 8);
    }
    ctx.fillStyle = "#fff";
    ctx.font = "bold 34px monospace";
    ctx.textAlign = "center";
    ctx.fillText("🏆 " + a.nombre + " gana 🏆", W / 2, 60);
    dibujarSprite("#f1c40f", a.x - 40, a.y - 40, 80, a.avatar);
  }

  function dibujar(estado) {
    dibujarFondo();
    dibujarRuleta(estado);
    dibujarMarcador(estado);
    estado.agentes.forEach((a) => dibujarAgente(a, estado));

    // pregunta actual sobre el preguntador
    if (estado.pregunta && estado.juego.estado === "jugando") {
      const autor = estado.agentes.find((a) => a.id === estado.pregunta.autor);
      if (autor) {
        dibujarGlobo(autor, estado.pregunta.pregunta || "", estado);
        const opciones = estado.pregunta.opciones || {};
        ctx.fillStyle = "#0b0c1c";
        ctx.fillRect(W / 2 - 210, H - 70, 420, 54);
        ctx.fillStyle = "#fff";
        ctx.font = "13px monospace";
        ctx.textAlign = "left";
        ctx.fillText("A) " + (opciones.A || "") + "   B) " + (opciones.B || ""), W / 2 - 200, H - 50);
        ctx.fillText("C) " + (opciones.C || "") + "   D) " + (opciones.D || ""), W / 2 - 200, H - 32);
      }
    }
    // globos de respuestas
    estado.agentes.forEach((a) => {
      if (estado.globos && estado.globos[a.id]) dibujarGlobo(a, estado.globos[a.id], estado);
    });

    dibujarReloj(estado);
    if (estado.juego.estado === "cuenta") dibujarCuenta(estado);
    if (estado.juego.estado === "esperando") dibujarEsperando(estado);
    if (estado.juego.estado === "final") dibujarGanador(estado);
  }

  function loop() {
    if (window.trujados) dibujar(window.trujados.estado);
    requestAnimationFrame(loop);
  }
  loop();
})();
