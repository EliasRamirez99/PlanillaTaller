/* ============================================================
   Resumen semanal completo (pestaña del inicio)
   - Elegís semana -> muestra TODAS las cargas de esa semana
     (Taller, Campo, Estacionarios, Almacén) + las respuestas.
   - Botón para descargar el PDF completo (una carga por hoja).
   Reutiliza los renderers del historial vía window.OPS_DETALLE.
   ============================================================ */
(function () {
  "use strict";

  const ORDEN = { Supervisores: 1, Campo: 2, Estacionarios: 3, Almacen: 4 };
  const setStatus = hacerStatus($("res-status"));
  const cont = $("res-contenido");

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function hist() {
    try { return JSON.parse(localStorage.getItem("ops_historial") || "[]") || []; } catch (e) { return []; }
  }
  function respHist() {
    try { return JSON.parse(localStorage.getItem("ops_resp_historial") || "[]") || []; } catch (e) { return []; }
  }
  function tablaR(headers, filas) {
    const th = headers.map((h) => `<th>${esc(h)}</th>`).join("");
    const trs = filas.filter((f) => f.some((c) => String(c == null ? "" : c).trim() !== ""))
      .map((f) => "<tr>" + f.map((c) => `<td>${esc(c)}</td>`).join("") + "</tr>").join("");
    if (!trs) return "";
    return `<table class="grid det"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
  }

  function cargasDe(sem) {
    const subs = hist().filter((s) => s.fila && String(s.fila.semana) === sem);
    subs.sort((a, b) =>
      (ORDEN[a.planilla] || 9) - (ORDEN[b.planilla] || 9) ||
      String(OPS_DETALLE.quien(a)).localeCompare(String(OPS_DETALLE.quien(b))));
    return subs;
  }

  // Arma el HTML del resumen (pantalla y PDF usan el mismo cuerpo).
  function cuerpoResumen(sem) {
    const subs = cargasDe(sem);
    let h = "";
    subs.forEach((sub) => {
      h += `<div class="res-carga"><h3 class="res-tit">${esc(OPS_DETALLE.nombre(sub.planilla))} — ${esc(OPS_DETALLE.quien(sub))}</h3>` +
        OPS_DETALLE.cuerpo(sub) + `</div>`;
    });
    const resp = respHist().find((x) => String(x.semana) === sem) || null;
    if (resp) {
      let rh = "";
      const tr = tablaR(["Dominio / Obra", "Repuesto", "Fecha pedido", "Tiempo estimado"],
        (resp.repuestos || []).map((r) => [r.dominio, r.repuesto, formatearFecha(r.fecha_pedido), r.tiempo_estimado]));
      if (tr) rh += `<h4>Espera de Repuestos — Respuesta Almacén</h4>${tr}`;
      const tn = tablaR(["Necesidad", "Fecha pedido", "Respuesta"],
        (resp.necesidades || []).map((n) => [n.necesidad, formatearFecha(n.fecha_pedido), n.respuesta]));
      if (tn) rh += `<h4>Necesidades — Respuesta</h4>${tn}`;
      if (rh) h += `<div class="res-carga"><h3 class="res-tit">Respuestas de Almacén y Jefatura</h3>${rh}</div>`;
    }
    return { html: h, cargas: subs.length, conResp: !!resp };
  }

  function tituloSem(sem) {
    const s = (LISTADOS.semanas || []).find((x) => x[0] === sem);
    return "Resumen Semanal Completo — " + sem +
      (s ? ` (${formatearFecha(s[1])} al ${formatearFecha(s[2])})` : "");
  }

  function render() {
    const sem = $("res-semana").value;
    cont.innerHTML = "";
    if (!sem) { setStatus("Elegí la semana para armar el resumen.", ""); return; }
    const r = cuerpoResumen(sem);
    if (!r.html) { setStatus("No hay planillas cargadas para " + sem + ".", ""); return; }
    setStatus(r.cargas + " planilla(s) cargada(s)" + (r.conResp ? " + respuestas" : "") + ".", "ok");
    cont.innerHTML = r.html;
  }

  function pdf() {
    const sem = $("res-semana").value;
    if (!sem) { setStatus("Elegí la semana primero.", "err"); return; }
    const r = cuerpoResumen(sem);
    if (!r.html) { setStatus("No hay nada para imprimir de esa semana.", "err"); return; }
    const w = window.open("", "_blank");
    if (!w) { alert("El navegador bloqueó la ventana emergente. Permití pop-ups para esta página y probá de nuevo."); return; }
    w.document.write(OPS_DETALLE.shell(tituloSem(sem), r.html));
    w.document.close();
  }

  // Trae historial y respuestas frescos del servidor y re-arma.
  function recargar() {
    if (!CONFIG.APPS_SCRIPT_URL) { render(); return; }
    setStatus("Actualizando…", "");
    Promise.all([
      postReintento({ accion: "historial" }, 2),
      postReintento({ accion: "historial_respuestas" }, 2),
    ]).then(([h, r]) => {
      if (h && h.ok) { try { localStorage.setItem("ops_historial", JSON.stringify(h.datos || [])); } catch (e) {} }
      if (r && r.ok) { try { localStorage.setItem("ops_resp_historial", JSON.stringify(r.datos || [])); } catch (e) {} }
      render();
    });
  }

  poblarSemanas($("res-semana"));
  $("res-semana").addEventListener("change", render);
  $("res-pdf").addEventListener("click", pdf);
  $("res-recargar").addEventListener("click", recargar);
  preseleccionarSemana("res-semana"); // dispara el render inicial con la semana de hoy
  if (!$("res-semana").value) render();
})();
