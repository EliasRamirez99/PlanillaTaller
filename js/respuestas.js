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
  function post(body) {
    return fetch(CONFIG.APPS_SCRIPT_URL, {
      method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
    }).then((r) => r.json());
  }
  function histCache() {
    try { return JSON.parse(localStorage.getItem("ops_historial") || "[]") || []; } catch (e) { return []; }
  }

  // Desplegable de semanas
  poblarSelect($("resp-semana"), LISTADOS.semanas, (s) => s[0], (s) => s[0]);
  $("resp-semana").addEventListener("change", onSemana);

  function onSemana() {
    const semana = $("resp-semana").value;
    if (!semana) { $("resp-planilla").innerHTML = ""; ACTUAL = null; return; }

    const subs = histCache().filter((s) => s.fila && String(s.fila.semana) === semana);
    const repuestos = [];   // de Supervisores
    const necesidades = []; // de Supervisores + Almacén

    subs.forEach((s) => {
      if (s.planilla === "Supervisores") {
        for (let i = 1; i <= MAXF; i++) {
          const dom = s.fila["rep" + i + "_dominio"], rep = s.fila["rep" + i + "_repuesto"], fec = s.fila["rep" + i + "_tiempo"];
          if (val(dom) || val(rep)) repuestos.push({ dominio: dom || "", repuesto: rep || "", fecha_pedido: fec || "", tiempo_estimado: "" });
        }
      }
      if (s.planilla === "Supervisores" || s.planilla === "Almacen") {
        for (let i = 1; i <= MAXF; i++) {
          const n = s.fila["nec" + i];
          if (val(n)) necesidades.push({ necesidad: n, origen: s.planilla, respuesta: "" });
        }
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
      html += '<table class="grid resp"><thead><tr><th>Dominio</th><th>Repuesto en espera</th><th>Fecha pedido</th><th>Tiempo estimado</th></tr></thead><tbody>';
      r.forEach((x, i) => {
        html += `<tr><td>${esc(x.dominio)}</td><td>${esc(x.repuesto)}</td><td>${esc(x.fecha_pedido)}</td>` +
          `<td><input type="text" data-rep="${i}" value="${esc(x.tiempo_estimado)}" /></td></tr>`;
      });
      html += "</tbody></table>";
    }
    html += "</div>";

    html += '<div class="card-form"><h2>Necesidades — Respuesta</h2>';
    if (!n.length) {
      html += '<p class="status">No hay necesidades cargadas para esta semana.</p>';
    } else {
      html += '<table class="grid resp"><thead><tr><th>Necesidad</th><th>Origen</th><th>Respuesta</th></tr></thead><tbody>';
      n.forEach((x, i) => {
        html += `<tr><td>${esc(x.necesidad)}</td><td>${esc(x.origen)}</td>` +
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
      necesidades: ACTUAL.necesidades.map((x) => ({ necesidad: x.necesidad, respuesta: x.respuesta })),
    })
      .then((out) => {
        if (out && out.ok) setStatus("✅ Respuestas guardadas.", "ok");
        else setStatus("❌ No se pudo guardar.", "err");
      })
      .catch(() => setStatus("❌ No se pudo conectar.", "err"));
  }
})();
