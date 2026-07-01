/* ============================================================
   Respuestas de jefatura (pestaña Respuestas del inicio)
   - Elegís semana -> arma 2 tablas con lo cargado por supervisores
     y almacén, y completás la respuesta. Se guarda por semana.
   ============================================================ */
(function () {
  "use strict";

  const MAXF = 33;
  let ACTUAL = null; // { semana, repuestos:[], necesidades:[] }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  const val = (x) => x != null && String(x).trim() !== "";
  function post(body) { return postReintento(body, 3); }
  function histCache() {
    try { return JSON.parse(localStorage.getItem("ops_historial") || "[]") || []; } catch (e) { return []; }
  }

  // Desplegable de semanas
  poblarSemanas($("resp-semana"));
  $("resp-semana").addEventListener("change", onSemana);

  function onSemana() {
    const semana = $("resp-semana").value;
    if (!semana) { $("resp-planilla").innerHTML = ""; ACTUAL = null; return; }

    const subs = histCache().filter((s) => s.fila && String(s.fila.semana) === semana);
    const repuestos = [];   // de Supervisores
    const necesidades = []; // de Supervisores + Almacén

    subs.forEach((s) => {
      const f = s.fila;
      const origen = s.planilla === "Supervisores"
        ? [f.supervisor, f.taller].filter(Boolean).join(" · ")
        : s.planilla === "Campo"
          ? "Campo — " + [f.supervisor, f.zona].filter(Boolean).join(" · ")
          : "Almacén" + (f.ubicacion ? " · " + f.ubicacion : "");

      // Repuestos en espera
      if (s.planilla === "Supervisores") {
        for (let i = 1; i <= MAXF; i++) {
          const dom = f["rep" + i + "_dominio"], rep = f["rep" + i + "_repuesto"], fec = f["rep" + i + "_tiempo"];
          if (val(dom) || val(rep)) repuestos.push({ dominio: dom || "", repuesto: rep || "", fecha_pedido: fec || "", tiempo_estimado: "", origen: origen });
        }
      } else if (s.planilla === "Campo") {
        (s.repuestos || []).forEach((r) => {
          if (val(r.obra) || val(r.repuesto)) repuestos.push({ dominio: r.obra || "", repuesto: r.repuesto || "", fecha_pedido: r.fecha || "", tiempo_estimado: "", origen: origen });
        });
      }

      // Necesidades / pendientes
      if (s.planilla === "Supervisores" || s.planilla === "Almacen") {
        for (let i = 1; i <= MAXF; i++) {
          const ne = f["nec" + i];
          if (val(ne)) necesidades.push({ necesidad: ne, origen: origen, fecha_pedido: formatearFecha(f["necfecha" + i]), respuesta: "" });
        }
      } else if (s.planilla === "Campo") {
        (s.pendientes || []).forEach((p) => {
          const txt = [p.obra, p.pendiente].filter(Boolean).join(": ");
          if (val(txt)) necesidades.push({ necesidad: txt, origen: origen, fecha_pedido: formatearFecha(p.fecha), respuesta: "" });
        });
      }
    });

    ACTUAL = { semana: semana, repuestos: repuestos, necesidades: necesidades };
    render();
    if (CONFIG.APPS_SCRIPT_URL) prefill(semana);
  }

  function render() {
    const r = ACTUAL.repuestos, n = ACTUAL.necesidades;
    let html = '<div class="card-form"><h2>Espera de Repuestos — Respuesta Almacén</h2>';
    if (!r.length) {
      html += '<p class="status">No hay repuestos en espera cargados para esta semana.</p>';
    } else {
      html += '<table class="grid resp"><thead><tr><th>Origen</th><th>Dominio / Obra</th><th>Repuesto en espera</th><th>Fecha pedido</th><th>Tiempo estimado</th></tr></thead><tbody>';
      r.forEach((x, i) => {
        html += `<tr><td>${esc(x.origen)}</td><td>${esc(x.dominio)}</td><td>${esc(x.repuesto)}</td><td>${esc(formatearFecha(x.fecha_pedido))}</td>` +
          `<td><input type="text" data-rep="${i}" value="${esc(x.tiempo_estimado)}" /></td></tr>`;
      });
      html += "</tbody></table>";
    }
    html += "</div>";

    html += '<div class="card-form"><h2>Necesidades — Respuesta</h2>';
    if (!n.length) {
      html += '<p class="status">No hay necesidades cargadas para esta semana.</p>';
    } else {
      html += '<table class="grid resp"><thead><tr><th>Necesidad</th><th>Origen</th><th>Fecha pedido</th><th>Respuesta</th></tr></thead><tbody>';
      n.forEach((x, i) => {
        html += `<tr><td>${esc(x.necesidad)}</td><td>${esc(x.origen)}</td><td>${esc(x.fecha_pedido)}</td>` +
          `<td><input type="text" data-nec="${i}" value="${esc(x.respuesta)}" /></td></tr>`;
      });
      html += "</tbody></table>";
    }
    html += "</div>";

    html += '<div class="actions"><button type="button" class="primary" id="resp-guardar">Guardar respuestas</button></div>';
    html += '<div class="status" id="resp-status"></div>';

    $("resp-planilla").innerHTML = html;
    const g = $("resp-guardar");
    if (g) g.addEventListener("click", guardar);
  }

  // Trae lo ya respondido para la semana y lo completa en las tablas.
  function prefill(semana) {
    post({ accion: "leer_respuestas", semana: semana })
      .then((out) => {
        if (!out || !out.ok || !out.datos) return;
        (out.datos.repuestos || []).forEach((sr) => {
          const m = ACTUAL.repuestos.find((x) => x.dominio === sr.dominio && x.repuesto === sr.repuesto && !x.tiempo_estimado);
          if (m) m.tiempo_estimado = sr.tiempo_estimado || "";
        });
        (out.datos.necesidades || []).forEach((sn) => {
          const m = ACTUAL.necesidades.find((x) => x.necesidad === sn.necesidad && !x.respuesta);
          if (m) m.respuesta = sn.respuesta || "";
        });
        render(); // re-pinta con lo respondido
      })
      .catch(() => {});
  }

  function guardar() {
    if (!ACTUAL) return;
    const setStatus = hacerStatus($("resp-status"));
    // recoger lo escrito
    document.querySelectorAll("#resp-planilla input[data-rep]").forEach((inp) => {
      ACTUAL.repuestos[+inp.dataset.rep].tiempo_estimado = inp.value.trim();
    });
    document.querySelectorAll("#resp-planilla input[data-nec]").forEach((inp) => {
      ACTUAL.necesidades[+inp.dataset.nec].respuesta = inp.value.trim();
    });

    if (!CONFIG.APPS_SCRIPT_URL) { setStatus("✅ (Demo) Sin Google configurado, no se envió.", "ok"); return; }

    setStatus("Guardando…", "");
    post({
      accion: "guardar_respuestas",
      semana: ACTUAL.semana,
      repuestos: ACTUAL.repuestos.map((x) => ({ dominio: x.dominio, repuesto: x.repuesto, fecha_pedido: x.fecha_pedido, tiempo_estimado: x.tiempo_estimado })),
      necesidades: ACTUAL.necesidades.map((x) => ({ necesidad: x.necesidad, respuesta: x.respuesta, fecha_pedido: x.fecha_pedido })),
    })
      .then((out) => {
        if (out && out.ok) { setStatus("✅ Respuestas guardadas.", "ok"); cargarRespHist(); }
        else setStatus("❌ No se pudo guardar.", "err");
      })
      .catch(() => setStatus("❌ No se pudo conectar.", "err"));
  }

  /* ---------- Historial de respuestas cargadas ---------- */
  const estadoRH = hacerStatus($("resp-historial-status"));
  let RESPHIST = [];

  function fmtFecha(v) {
    if (!v) return "";
    const d = new Date(v);
    if (isNaN(d)) return esc(v);
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function tablaDet(headers, filas) {
    const th = headers.map((h) => `<th>${esc(h)}</th>`).join("");
    const trs = filas.filter((f) => f.some((c) => String(c).trim() !== ""))
      .map((f) => "<tr>" + f.map((c) => `<td>${esc(c)}</td>`).join("") + "</tr>").join("");
    if (!trs) return "";
    return `<table class="grid det"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
  }

  function cargarRespHist() {
    let mostrado = false;
    try {
      const c = JSON.parse(localStorage.getItem("ops_resp_historial") || "null");
      if (c && c.length) { renderRespHist(c); mostrado = true; }
    } catch (e) {}
    if (!CONFIG.APPS_SCRIPT_URL) { if (!mostrado) estadoRH("Configurá Google para ver el historial.", ""); return; }
    if (!mostrado) estadoRH("Cargando…", "");
    post({ accion: "historial_respuestas" })
      .then((out) => {
        if (out && out.ok) {
          renderRespHist(out.datos || []);
          try { localStorage.setItem("ops_resp_historial", JSON.stringify(out.datos || [])); } catch (e) {}
        } else if (!mostrado) estadoRH("No se pudo cargar el historial.", "err");
      })
      .catch(() => { if (!mostrado) estadoRH("No se pudo conectar para traer el historial.", "err"); });
  }

  let LIMITE_RH = 30;

  function renderRespHist(datos) {
    RESPHIST = datos || [];
    LIMITE_RH = 30;
    pintaRH();
  }
  function pintaRH() {
    const cont = $("resp-historial");
    if (!RESPHIST.length) { cont.innerHTML = ""; estadoRH("Todavía no hay respuestas cargadas.", ""); return; }
    estadoRH("", "");
    const vis = RESPHIST.slice(0, LIMITE_RH);
    const filas = vis.map((x, i) => `<tr data-i="${i}">
      <td>${esc(x.semana || "")}</td>
      <td>${esc(fmtFecha(x.timestamp))}</td>
      <td>${(x.repuestos || []).length}</td>
      <td>${(x.necesidades || []).length}</td>
      <td class="ver">Ver ▸</td></tr>`).join("");
    let html = `<table class="grid hist"><thead>
      <tr><th>Semana</th><th>Guardado</th><th>Repuestos</th><th>Necesidades</th><th></th></tr>
      </thead><tbody>${filas}</tbody></table>`;
    if (RESPHIST.length > LIMITE_RH) {
      html += `<div class="ver-mas"><button type="button" class="ghost small" id="resp-mas">Ver anteriores (${RESPHIST.length - LIMITE_RH} más)</button></div>`;
    }
    cont.innerHTML = html;
    cont.querySelectorAll("tbody tr").forEach((tr) => {
      tr.addEventListener("click", () => abrirDetalleResp(vis[+tr.dataset.i]));
    });
    const mas = $("resp-mas");
    if (mas) mas.addEventListener("click", () => { LIMITE_RH += 30; pintaRH(); });
  }

  function abrirDetalleResp(x) {
    let h = `<h3>Respuestas — ${esc(x.semana)}</h3>`;
    const tr = tablaDet(["Dominio", "Repuesto", "Fecha pedido", "Tiempo estimado"],
      (x.repuestos || []).map((r) => [r.dominio, r.repuesto, formatearFecha(r.fecha_pedido), r.tiempo_estimado]));
    if (tr) h += `<h4>Espera de Repuestos</h4>${tr}`;
    const tn = tablaDet(["Necesidad", "Fecha pedido", "Respuesta"],
      (x.necesidades || []).map((n) => [n.necesidad, formatearFecha(n.fecha_pedido), n.respuesta]));
    if (tn) h += `<h4>Necesidades</h4>${tn}`;
    $("detalle-body").innerHTML = h;
    $("detalle").style.display = "flex";
  }

  $("btn-recargar-resp").addEventListener("click", cargarRespHist);
  cargarRespHist();
})();
