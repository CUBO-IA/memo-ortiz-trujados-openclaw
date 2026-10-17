// Lienzo 2D de Trujados — pixel art procedural, ruleta animada y confeti.
(function () {
  const canvas = document.getElementById("lienzo");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = 960, H = 540;
  canvas.width = W; canvas.height = H;
  ctx.imageSmoothingEnabled = false;

  const PALETA = ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6", "#e67e22", "#1abc9c", "#e84393"];
  const PALETA_OSCURA = ["#922b21", "#1f4e79", "#1e8449", "#9a7d0a", "#6c3483", "#935116", "#117864", "#922b55"];
  const COLORES_CAT = { Ciencia:"#3498db", Historia:"#e67e22", Geografía:"#2ecc71", Arte:"#e84393", Deportes:"#f1c40f", Entretenimiento:"#9b59b6" };
  const CATS_ORDEN = ["Ciencia","Historia","Geografía","Arte","Deportes","Entretenimiento"];

  // estado de animación local
  let spinAngulo = 0;
  let spin = null;
  let ultimaCategoria = null;
  let confeti = [];
  let confetiActivo = false;

  function p(x,y,w,h,color){ ctx.fillStyle=color; ctx.fillRect(x,y,w,h); }

  // Personaje pixel-art 16x16 con variantes
  function dibujarPersonaje(c, variante, x, y, s) {
    const u = s/16;
    const skin = "#f6c89f";
    const dark = PALETA_OSCURA[variante % PALETA_OSCURA.length];
    function px(px,py,pw,ph,color){ p(x+px*u, y+py*u, pw*u, ph*u, color); }
    // piernas
    px(6,13,2,3,dark); px(9,13,2,3,dark);
    // torso
    px(4,8,9,5,c);
    px(4,8,2,5, "rgba(0,0,0,0.18)"); // sombra lateral
    // brazos
    px(3,9,1,4,skin); px(13,9,1,4,skin);
    // cabeza
    px(4,3,8,5,skin);
    px(4,3,1,5, "rgba(0,0,0,0.12)");
    // ojos
    px(6,5,2,2,"#222"); px(9,5,2,2,"#222");
    // boca
    px(7,7,3,1,"#b0563a");
    // accesorios
    const v = variante % 8;
    if (v === 0) { px(4,1,8,2,c); px(3,3,1,2,c); }               // gorra
    else if (v === 1) { px(5,4,2,2,"#222"); px(9,4,2,2,"#222"); px(7,5,2,1,"#222"); } // anteojos
    else if (v === 2) { px(4,0,8,2,"#f1c40f"); px(4,2,2,1,"#f1c40f"); px(10,2,2,1,"#f1c40f"); } // corona
    else if (v === 3) { px(7,0,1,3,"#888"); px(6,0,3,2,"#e74c3c"); } // antena
    else if (v === 4) { px(5,0,2,3,c); px(7,0,2,2,c); px(9,0,2,3,c); } // mohawk
    else if (v === 5) { px(4,0,8,3,"#111"); px(3,3,10,1,"#111"); }  // sombrero copa
    else if (v === 6) { px(3,0,10,1,"#111"); px(3,1,1,3,"#111"); px(12,1,1,3,"#111"); } // auriculares
    else { px(4,1,8,1,"#fff"); px(3,1,1,2,"#fff"); px(12,1,1,2,"#fff"); } // vincha
  }

  function dibujarFondo() {
    // pared
    p(0,0,W,300,"#151a3a");
    // detalles de pared (cuadros)
    p(W-190,40,120,80,"rgba(255,255,255,0.04)");
    p(W-186,44,112,72,"rgba(255,255,255,0.05)");
    // franja divisoria
    p(0,300,W,6,"#6c5ce7");
    // piso
    p(0,306,W,H-306,"#0e1026");
    for (let i=0;i<W;i+=64) for (let j=306;j<H;j+=40) {
      if (((i/64)+((j-306)/40))%2===0) p(i,j,64,40,"rgba(255,255,255,0.03)");
    }
    // título
    ctx.fillStyle="#bbdd44"; ctx.font="bold 30px monospace"; ctx.textAlign="center";
    ctx.fillText("TRUJADOS", W/2, 46);
    ctx.fillStyle="rgba(255,255,255,0.45)"; ctx.font="12px monospace";
    ctx.fillText("los jugadores son agentes", W/2, 64);
    // mesas
    for (let i=0;i<3;i++){
      const mx=130+i*290, my=410;
      p(mx,my,150,12,"#5a3d24");
      p(mx+12,my+12,10,42,"#3a2a18");
      p(mx+128,my+12,10,42,"#3a2a18");
    }
  }

  function actualizarSpin(estado) {
    if (estado.categoria && estado.categoria !== ultimaCategoria) {
      ultimaCategoria = estado.categoria;
      const idx = Math.max(0, CATS_ORDEN.indexOf(estado.categoria));
      const objetivo = -Math.PI/2 - idx*(Math.PI/3);
      let to = objetivo;
      while (to < spinAngulo + Math.PI*4) to += Math.PI*2;
      spin = { from: spinAngulo, to: to, start: Date.now(), dur: 1100 };
    }
    if (spin) {
      const t = (Date.now() - spin.start)/spin.dur;
      if (t >= 1) { spinAngulo = spin.to; spin = null; }
      else { const e = 1 - Math.pow(1-t,3); spinAngulo = spin.from + (spin.to-spin.from)*e; }
    }
  }

  function dibujarRuleta(estado) {
    const cx=92, cy=118, r=54;
    ctx.save();
    p(cx-r-9, cy-r-9, (r+9)*2, (r+9)*2, "rgba(0,0,0,0.4)");
    ctx.beginPath(); ctx.arc(cx,cy,r+5,0,Math.PI*2); ctx.fillStyle="#0b0c1c"; ctx.fill();
    ctx.save();
    ctx.translate(cx,cy); ctx.rotate(spinAngulo);
    CATS_ORDEN.forEach((c,i)=>{
      const a0 = i*(Math.PI/3) - Math.PI/6;
      const a1 = a0 + Math.PI/3;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,r,a0,a1); ctx.closePath();
      ctx.fillStyle=COLORES_CAT[c]; ctx.fill();
      ctx.strokeStyle="rgba(0,0,0,0.55)"; ctx.lineWidth=2; ctx.stroke();
    });
    ctx.beginPath(); ctx.arc(0,0,12,0,Math.PI*2); ctx.fillStyle="#0b0c1c"; ctx.fill();
    ctx.restore();
    // puntero arriba
    ctx.fillStyle="#fff";
    ctx.beginPath();
    ctx.moveTo(cx-11, cy-r+3); ctx.lineTo(cx+11, cy-r+3); ctx.lineTo(cx, cy-r+18);
    ctx.closePath(); ctx.fill();
    // borde exterior
    ctx.beginPath(); ctx.arc(cx,cy,r+5,0,Math.PI*2); ctx.strokeStyle="#fff"; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle="#fff"; ctx.font="bold 14px monospace"; ctx.textAlign="center";
    ctx.fillText(estado.categoria || "", cx, cy+r+24);
    ctx.restore();
  }

  function dibujarMarcador(estado) {
    const xs = W-172, ys = 26;
    const orden = estado.agentes.slice().sort((a,b)=>b.puntos-a.puntos);
    const h = 44 + orden.length*28;
    p(xs-14, ys-14, 186, h, "rgba(0,0,0,0.55)");
    ctx.strokeStyle="#2e3060"; ctx.lineWidth=1.5; ctx.strokeRect(xs-14, ys-14, 186, h);
    ctx.fillStyle="#fff"; ctx.font="bold 15px monospace"; ctx.textAlign="left";
    ctx.fillText("MARCADOR", xs, ys+4);
    p(xs, ys+12, 158, 2, "#6c5ce7");
    orden.forEach((a,i)=>{
      const med = i===0?"1°":i===1?"2°":i===2?"3°":"·";
      ctx.fillStyle = PALETA[a.avatar % PALETA.length];
      ctx.fillText(med+"  "+a.nombre, xs, ys+34+i*28);
      ctx.fillStyle="#f1c40f"; ctx.textAlign="right";
      ctx.fillText(String(a.puntos)+" pts", xs+158, ys+34+i*28);
      ctx.textAlign="left";
    });
  }

  function dibujarAgente(a, estado) {
    const c = PALETA[a.avatar % PALETA.length];
    const desconectado = estado.juego.estado !== "lobby" && !a.conectado;
    const bob = Math.sin(Date.now()/500 + a.x) * 3;
    ctx.save();
    if (desconectado) ctx.globalAlpha = 0.35;
    // sombra
    p(a.x-22, a.y+26, 44, 8, "rgba(0,0,0,0.35)");
    dibujarPersonaje(c, a.avatar, a.x-26, a.y-34+bob, 52);
    ctx.fillStyle="#fff"; ctx.font="bold 12px monospace"; ctx.textAlign="center";
    ctx.fillText(a.nombre, a.x, a.y+38);
    ctx.fillStyle="#f1c40f";
    ctx.fillText(a.puntos+" pts", a.x, a.y+52);
    ctx.restore();
  }

  function envolverTexto(texto, maxChars) {
    const palabras = String(texto || "").split(" ");
    const lineas = []; let actual = "";
    for (const p of palabras) {
      const candidato = actual ? actual+" "+p : p;
      if (candidato.length <= maxChars) actual = candidato;
      else {
        if (actual) lineas.push(actual);
        if (p.length > maxChars) { for (let i=0;i<p.length;i+=maxChars) lineas.push(p.slice(i,i+maxChars)); actual=""; }
        else actual = p;
      }
    }
    if (actual) lineas.push(actual);
    return lineas.slice(0,6);
  }

  function dibujarGlobo(agente, texto, estado) {
    ctx.save();
    ctx.font = "bold 12px monospace";
    const lineas = envolverTexto(texto, 34);
    const charW = 7.2;
    const maxLen = Math.max(...lineas.map((l)=>l.length));
    const w = Math.min(240, Math.max(40, maxLen*charW+20));
    const lineH = 16;
    const h = lineas.length*lineH + 14;
    let bx = agente.x - w/2; bx = Math.max(4, Math.min(bx, W-w-4));
    let by = agente.y - 86 - h; if (by < 4) by = agente.y + 40;
    p(bx-3, by-3, w+6, h+6, "rgba(0,0,0,0.4)");
    p(bx, by, w, h, "#fff");
    ctx.strokeStyle="#2e3060"; ctx.lineWidth=1.5; ctx.strokeRect(bx,by,w,h);
    ctx.fillStyle="#111"; ctx.textAlign="left";
    lineas.forEach((l,i)=>ctx.fillText(l, bx+10, by+18+i*lineH));
    ctx.fillStyle="#fff";
    ctx.beginPath();
    const py = by+h;
    ctx.moveTo(agente.x-7,py); ctx.lineTo(agente.x+7,py); ctx.lineTo(agente.x,py+12);
    ctx.fill();
    ctx.restore();
  }

  function dibujarReloj(estado) {
    const t = estado.reloj != null ? estado.reloj : (estado.juego.segundosRestantes || 0);
    p(W/2-50, 22, 100, 36, "rgba(0,0,0,0.6)");
    ctx.strokeStyle="#6c5ce7"; ctx.lineWidth=2; ctx.strokeRect(W/2-50,22,100,36);
    ctx.fillStyle="#fff"; ctx.font="bold 20px monospace"; ctx.textAlign="center";
    const mm=Math.floor(t/60), ss=String(t%60).padStart(2,"0");
    ctx.fillText(mm+":"+ss, W/2, 48);
  }

  function dibujarCuenta(estado) {
    p(0,0,W,H,"rgba(0,0,0,0.75)");
    const pulso = 1 + Math.sin(Date.now()/200)*0.06;
    ctx.fillStyle="#fff"; ctx.font="bold " + Math.round(96*pulso) + "px monospace"; ctx.textAlign="center";
    ctx.fillText(String(estado.cuenta), W/2, H/2+20);
    ctx.fillStyle="#bbdd44"; ctx.font="22px monospace";
    ctx.fillText("Preparate…", W/2, H/2+74);
  }

  function dibujarEsperando(estado) {
    p(0,0,W,H,"rgba(0,0,0,0.75)");
    ctx.fillStyle="#fff"; ctx.font="bold 42px monospace"; ctx.textAlign="center";
    ctx.fillText("Esperando resultado…", W/2, H/2-20);
    const pts = ".".repeat((Math.floor(Date.now()/400)%4));
    ctx.fillText(pts, W/2, H/2+34);
  }

  function lanzarConfeti() {
    if (!confetiActivo) {
      confetiActivo = true;
      confeti = [];
      for (let i=0;i<140;i++) confeti.push({
        x: Math.random()*W, y: -20-Math.random()*H,
        vy: 1.5+Math.random()*2.5, vx: (Math.random()-0.5)*1.6,
        color: PALETA[i%PALETA.length], tam: 4+Math.random()*6, rot: Math.random()*Math.PI*2
      });
    }
    for (const c of confeti) {
      c.x += c.vx; c.y += c.vy; c.rot += 0.1;
      if (c.y > H+20) { c.y=-20; c.x=Math.random()*W; }
    }
    for (const c of confeti) {
      ctx.save(); ctx.translate(c.x,c.y); ctx.rotate(c.rot);
      p(-c.tam/2,-c.tam/2,c.tam,c.tam,c.color);
      ctx.restore();
    }
  }

  function dibujarGanador(estado) {
    const a = estado.agentes.find((x)=>x.id===estado.juego.ganador);
    if (!a) return;
    lanzarConfeti();
    p(0,0,W,H,"rgba(0,0,0,0.35)");
    ctx.fillStyle="#fff"; ctx.font="bold 40px monospace"; ctx.textAlign="center";
    ctx.fillText("🏆 " + a.nombre + " gana 🏆", W/2, 64);
    dibujarPersonaje("#f1c40f", a.avatar, a.x-44, a.y-44, 88);
  }

  function dibujar(estado) {
    actualizarSpin(estado);
    if (estado.juego.estado !== "final") confetiActivo = false;
    dibujarFondo();
    dibujarRuleta(estado);
    dibujarMarcador(estado);
    estado.agentes.forEach((a)=>dibujarAgente(a, estado));
    if (estado.pregunta && estado.juego.estado === "jugando") {
      const autor = estado.agentes.find((a)=>a.id===estado.pregunta.autor);
      if (autor) {
        dibujarGlobo(autor, estado.pregunta.pregunta || "", estado);
        const opciones = estado.pregunta.opciones || {};
        p(W/2-230, H-74, 460, 60, "rgba(0,0,0,0.75)");
        ctx.strokeStyle="#6c5ce7"; ctx.lineWidth=2; ctx.strokeRect(W/2-230, H-74, 460, 60);
        ctx.fillStyle="#fff"; ctx.font="13px monospace"; ctx.textAlign="left";
        ctx.fillText("A) "+(opciones.A||"")+"    B) "+(opciones.B||""), W/2-220, H-52);
        ctx.fillText("C) "+(opciones.C||"")+"    D) "+(opciones.D||""), W/2-220, H-32);
      }
    }
    estado.agentes.forEach((a)=>{ if (estado.globos && estado.globos[a.id]) dibujarGlobo(a, estado.globos[a.id], estado); });
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
