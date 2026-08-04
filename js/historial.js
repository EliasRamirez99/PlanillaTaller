/* ============================================================
   Historial de planillas cargadas (en el inicio)
   - Lista las cargas leídas de la Google Sheet.
   - Al hacer clic en una, muestra el detalle completo.
   ============================================================ */
(function () {
  "use strict";

  const cont = $("historial");
  const estado = hacerStatus($("historial-status"));

  // ---------- utilidades ----------
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function fmtFecha(v) {
    if (!v) return "";
    const d = new Date(v);
    if (isNaN(d)) return esc(v);
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  // Sólo día (las fechas desde/hasta vuelven como ISO desde Sheets).
  function fmtDia(v) {
    if (!v) return "";
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
      const d = new Date(s);
      if (!isNaN(d)) {
        const p = (n) => String(n).padStart(2, "0");
        return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
      }
    }
    return s;
  }
  // Tabla a partir de encabezados y filas (arrays); descarta filas totalmente vacías.
  function tabla(headers, filas) {
    const th = headers.map((h) => `<th>${esc(h)}</th>`).join("");
    const trs = filas
      .filter((f) => f.some((c) => String(c).trim() !== ""))
      .map((f) => "<tr>" + f.map((c) => `<td>${esc(c)}</td>`).join("") + "</tr>")
      .join("");
    if (!trs) return "";
    return `<table class="grid det"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
  }
  function campos(pares) {
    const items = pares
      .filter(([, v]) => String(v == null ? "" : v).trim() !== "")
      .map(([k, v]) => `<div class="kv"><span>${esc(k)}</span><b>${esc(v)}</b></div>`)
      .join("");
    return `<div class="kvs">${items}</div>`;
  }

  const NOMBRE = {
    Supervisores: "Supervisores de Taller", Campo: "Supervisores de Campo",
    Estacionarios: "Equipos Estacionarios", Almacen: "Almacén",
  };
  function nombrePlanilla(p) { return NOMBRE[p] || p; }

  // ---------- detalle por planilla ----------
  function repuestosDesdeFila(f, n, etiqueta) {
    const filas = [];
    for (let i = 1; i <= n; i++) {
      filas.push([f[`rep${i}_dominio`] || "", f[`rep${i}_repuesto`] || "", formatearFecha(f[`rep${i}_tiempo`])]);
    }
    return tabla(["Dominio", etiqueta || "Repuesto", "Fecha de pedido"], filas);
  }
  function necesidadesDesdeFila(f, n) {
    const filas = [];
    for (let i = 1; i <= n; i++) filas.push([f[`nec${i}`] || "", formatearFecha(f[`necfecha${i}`])]);
    return tabla(["Necesidad", "Fecha de pedido"], filas);
  }

  function tercerizadosDesdeFila(f, n) {
    const filas = [];
    for (let i = 1; i <= n; i++) {
      filas.push([f[`ter${i}_dominio`] || "", f[`ter${i}_razon`] || "", formatearFecha(f[`ter${i}_fecha`])]);
    }
    return tabla(["Dominio", "Razón", "Fecha"], filas);
  }
  function bloqueObs(f) {
    const o = String(f.observaciones == null ? "" : f.observaciones).trim();
    return o ? `<h4>Observaciones</h4><p class="obs-det">${esc(o)}</p>` : "";
  }

  function detalleSupervisores(f) {
    let h = campos([
      ["Supervisor", f.supervisor], ["Ubicación", f.ubicacion], ["Taller", f.taller],
      ["Mecánicos", f.cant_mecanicos],
      ["Órdenes realizadas", f.ordenes], ["Tareas realizadas", f.tareas],
      ["En reparación", f.en_reparacion], ["Tercerizado", f.tercerizado],
      ["Espera de repuesto", f.espera_repuesto], ["Necesidades", f.necesidades_cant],
    ]);
    const rep = repuestosDesdeFila(f, 33);
    if (rep) h += `<h4>Repuestos en espera</h4>${rep}`;
    const ter = tercerizadosDesdeFila(f, 33);
    if (ter) h += `<h4>Tercerizado</h4>${ter}`;
    const nec = necesidadesDesdeFila(f, 33);
    if (nec) h += `<h4>Necesidades</h4>${nec}`;
    return h + bloqueObs(f);
  }

  function detalleEstacionarios(sub) {
    const f = sub.fila;
    let h = campos([["Ubicación", f.ubicacion], ["Pañoleros", f.cant_panoleros]]);
    const filas = (sub.equipos || []).map((e) => [e.equipo, e.operativa, e.no_operativa, e.total]);
    const t = tabla(["Equipo", "Operativa", "No Operativa", "Total"], filas);
    if (t) h += `<h4>Equipos</h4>${t}`;
    return h + bloqueObs(f);
  }

  function detalleAlmacen(f) {
    let h = campos([["Ubicación", f.ubicacion], ["Pañoleros", f.cant_panoleros]]);
    const mov = [
      ["OR Cargadas", f.or_cargadas_total, f.or_cargadas_items, f.or_cargadas_repuestos],
      ["Remitos de Egreso", f.remitos_egreso_total, f.remitos_egreso_items, f.remitos_egreso_repuestos],
      ["Remitos de Ingreso", f.remitos_ingreso_total, f.remitos_ingreso_items, f.remitos_ingreso_repuestos],
    ];
    const tm = tabla(["", "Total", "Items dif.", "Repuestos"], mov);
    if (tm) h += `<h4>Movimientos</h4>${tm}`;

    const tr = [
      ["720", f.transf_720_total, f.transf_720_items, f.transf_720_repuestos],
      ["745", f.transf_745_total, f.transf_745_items, f.transf_745_repuestos],
      ["758", f.transf_758_total, f.transf_758_items, f.transf_758_repuestos],
      ["760", f.transf_760_total, f.transf_760_items, f.transf_760_repuestos],
      ["Base 7", f.transf_base7_total, f.transf_base7_items, f.transf_base7_repuestos],
    ];
    const tt = tabla(["Destino", "Total", "Items dif.", "Repuestos"], tr);
    if (tt) h += `<h4>Transferencias a:</h4>${tt}`;

    const vehF = [];
    for (let i = 1; i <= 33; i++) vehF.push([f[`veh${i}_dominio`] || "", f[`veh${i}_asignacion`] || "", f[`veh${i}_km`] || "", f[`veh${i}_litros`] || ""]);
    const veh = tabla(["Dominio", "Asignación", "Km", "Litros"], vehF);
    if (veh) h += `<h4>Vehículos utilizados</h4>${veh}`;

    const insF = [];
    for (let i = 1; i <= 33; i++) insF.push([f[`ins${i}_insumo`] || "", f[`ins${i}_cantidad`] || "", f[`insunidad${i}`] || ""]);
    const ins = tabla(["Insumo", "Cantidad", "Unidad"], insF);
    if (ins) h += `<h4>Insumos utilizados</h4>${ins}`;

    const rep = repuestosDesdeFila(f, 33, "Repuesto / Obs.");
    if (rep) h += `<h4>Repuestos en espera</h4>${rep}`;
    const nec = necesidadesDesdeFila(f, 33);
    if (nec) h += `<h4>Necesidades</h4>${nec}`;
    return h + bloqueObs(f);
  }

  const PAG = { Supervisores: "supervisores.html", Estacionarios: "estacionarios.html", Almacen: "almacen.html", Campo: "campo.html" };

  function detalleCampo(sub) {
    const f = sub.fila;
    let h = campos([["Supervisor", f.supervisor], ["Referente", f.referente], ["Zona", f.zona]]);
    const to = tabla(["Obra", "Órdenes", "Tareas"], (sub.obras || []).map((o) => [o.obra, o.ordenes, o.tareas]));
    if (to) h += `<h4>Obras</h4>${to}`;
    const tv = tabla(["Dominio", "Asignación", "Km", "Litros"], (sub.vehiculos || []).map((v) => [v.dominio, v.asignacion, v.km, v.litros]));
    if (tv) h += `<h4>Vehículos utilizados</h4>${tv}`;
    const tr = tabla(["Obra", "Repuesto", "Fecha de pedido"], (sub.repuestos || []).map((r) => [r.obra, r.repuesto, formatearFecha(r.fecha)]));
    if (tr) h += `<h4>Espera de repuestos</h4>${tr}`;
    const tp = tabla(["Obra", "Necesidad", "Fecha de pedido"], (sub.pendientes || []).map((p) => [p.obra, p.pendiente, formatearFecha(p.fecha)]));
    if (tp) h += `<h4>Necesidades</h4>${tp}`;
    return h + bloqueObs(f);
  }

  // Datos de la carga (encabezado + detalle según planilla). Compartido por el
  // modal "Ver" y la vista de impresión (PDF).
  function cuerpoDetalle(sub) {
    const f = sub.fila;
    let cuerpo = campos([
      ["Cargado", fmtFecha(f.timestamp)],
      ["Semana", f.semana],
      ["Período", formatearFecha(f.desde) + (f.hasta ? " al " + formatearFecha(f.hasta) : "")],
    ]);
    if (sub.planilla === "Supervisores") cuerpo += detalleSupervisores(f);
    else if (sub.planilla === "Estacionarios") cuerpo += detalleEstacionarios(sub);
    else if (sub.planilla === "Almacen") cuerpo += detalleAlmacen(f);
    else if (sub.planilla === "Campo") cuerpo += detalleCampo(sub);
    return cuerpo;
  }

  function abrirDetalle(sub) {
    const f = sub.fila;
    const cuerpo =
      `<h3>${esc(nombrePlanilla(sub.planilla))} <button type="button" class="ghost small" id="det-editar">✎ Editar / corregir</button>` +
      ` <button type="button" class="ghost small" id="det-pdf">🖨 PDF</button></h3>` +
      cuerpoDetalle(sub);

    $("detalle-body").innerHTML = cuerpo;
    $("detalle").style.display = "flex";

    const be = $("det-editar");
    if (be && PAG[sub.planilla]) {
      be.addEventListener("click", () => {
        const payload = Object.assign({}, sub, { id: f.timestamp });
        sessionStorage.setItem("ops_edit", JSON.stringify(payload));
        location.href = PAG[sub.planilla];
      });
    }
    const bp = $("det-pdf");
    if (bp) bp.addEventListener("click", () => imprimirPDF(sub));
  }

  // ---------- PDF para imprimir ----------
  function armarHTMLImpresion(sub) {
    const f = sub.fila;
    const titulo = `${nombrePlanilla(sub.planilla)} — ${f.semana || ""}`;
    const estilos = `
      * { box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #222; margin: 24px; }
      .enc { display: flex; align-items: center; gap: 10px; border-bottom: 3px solid #6a9739; padding-bottom: 8px; margin-bottom: 12px; }
      .enc .logo { background: #6a9739; color: #fff; font-weight: bold; padding: 5px 10px; border-radius: 6px; font-size: 15px; }
      .enc .emp { font-size: 13px; color: #555; }
      h2 { font-size: 16px; margin: 6px 0 10px; text-transform: uppercase; }
      h4 { font-size: 13px; margin: 14px 0 4px; color: #46652a; border-bottom: 1px solid #cfe0b8; padding-bottom: 2px; }
      .kvs { display: flex; flex-wrap: wrap; gap: 4px 18px; margin: 6px 0; }
      .kv span { color: #666; }
      .kv b { margin-left: 4px; }
      table.grid { border-collapse: collapse; width: 100%; margin: 4px 0; page-break-inside: auto; }
      table.grid th, table.grid td { border: 1px solid #999; padding: 4px 6px; text-align: left; vertical-align: top; }
      table.grid th { background: #dfeccb; }
      tr { page-break-inside: avoid; }
      .obs-det { white-space: pre-wrap; border: 1px solid #ccc; border-radius: 4px; padding: 8px; background: #fafaf5; }
      .pie { margin-top: 18px; font-size: 10px; color: #888; border-top: 1px solid #ddd; padding-top: 6px; }
      @media print { body { margin: 10mm; } }
    `;
    return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title>` +
      `<style>${estilos}</style></head><body>` +
      `<div class="enc"><span class="logo">OPS</span><span class="emp">Oilfield Production Services</span></div>` +
      `<h2>${esc(titulo)}</h2>` +
      cuerpoDetalle(sub) +
      `<div class="pie">Generado desde Planillas OPS — ${esc(fmtFecha(new Date().toISOString()))}</div>` +
      `<script>window.onload = function () { window.print(); };<\/script>` +
      `</body></html>`;
  }

  function imprimirPDF(sub) {
    const w = window.open("", "_blank");
    if (!w) { alert("El navegador bloqueó la ventana emergente. Permití pop-ups para esta página y probá de nuevo."); return; }
    w.document.write(armarHTMLImpresion(sub));
    w.document.close();
  }

  // ---------- lista ----------
  function quien(sub) {
    const f = sub.fila;
    if (sub.planilla === "Supervisores") return [f.supervisor, f.taller].filter(Boolean).join(" · ");
    if (sub.planilla === "Campo") return [f.supervisor, f.zona].filter(Boolean).join(" · ");
    if (sub.planilla === "Estacionarios") return `${f.ubicacion || ""} (${(sub.equipos || []).length} equipos)`;
    return f.ubicacion || "";
  }

  // ---------- filtros ----------
  let DATOS = [];

  function uniq(arr) {
    return Array.from(new Set(arr.filter((x) => x != null && String(x).trim() !== "")));
  }
  function rellenar(sel, valores) {
    const actual = sel.value;
    sel.innerHTML = '<option value="">Todas</option>' +
      valores.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
    if (valores.indexOf(actual) >= 0) sel.value = actual;
  }
  function poblarFiltros() {
    rellenar($("filtro-semana"), uniq(DATOS.map((s) => s.fila.semana)));
    rellenar($("filtro-familia"), uniq(DATOS.map((s) => s.planilla)));
  }
  let LIMITE = 30;
  let FILTRADOS = [];

  function aplicarFiltro() {
    const s = $("filtro-semana").value;
    const fam = $("filtro-familia").value;
    LIMITE = 30;
    pintarLista(DATOS.filter((sub) =>
      (!s || sub.fila.semana === s) && (!fam || sub.planilla === fam)));
  }

  function pintarLista(items) {
    FILTRADOS = items;
    if (!DATOS.length) { cont.innerHTML = ""; estado("Todavía no hay planillas cargadas.", ""); return; }
    if (!items.length) { cont.innerHTML = ""; estado("No hay cargas para ese filtro.", ""); return; }
    estado("", "");
    const visibles = items.slice(0, LIMITE);
    const filas = visibles.map((sub, i) => {
      const f = sub.fila;
      return `<tr data-i="${i}">
        <td>${esc(fmtFecha(f.timestamp))}</td>
        <td><span class="badge b-${esc(sub.planilla)}">${esc(nombrePlanilla(sub.planilla))}</span></td>
        <td>${esc(f.semana || "")}</td>
        <td>${esc(quien(sub))}</td>
        <td class="ver">Ver ▸</td>
        <td class="pdf" title="Imprimir / guardar PDF">🖨 PDF</td>
      </tr>`;
    }).join("");
    let html = `<table class="grid hist"><thead>
      <tr><th>Cargado</th><th>Planilla</th><th>Semana</th><th>Detalle</th><th></th><th></th></tr>
      </thead><tbody>${filas}</tbody></table>`;
    if (items.length > LIMITE) {
      html += `<div class="ver-mas"><button type="button" class="ghost small" id="hist-mas">Ver anteriores (${items.length - LIMITE} más)</button></div>`;
    }
    cont.innerHTML = html;
    cont.querySelectorAll("tbody tr").forEach((tr) => {
      tr.addEventListener("click", () => abrirDetalle(visibles[+tr.dataset.i]));
      const pdf = tr.querySelector("td.pdf");
      if (pdf) pdf.addEventListener("click", (e) => {
        e.stopPropagation();
        imprimirPDF(visibles[+tr.dataset.i]);
      });
    });
    const mas = $("hist-mas");
    if (mas) mas.addEventListener("click", () => { LIMITE += 30; pintarLista(FILTRADOS); });
  }

  function render(datos) {
    DATOS = datos || [];
    poblarFiltros();
    aplicarFiltro();
  }

  function cargar() {
    // 1) Mostrar al instante lo último cacheado (sin depender de internet).
    let mostrado = false;
    try {
      const cache = JSON.parse(localStorage.getItem("ops_historial") || "null");
      if (cache && cache.length) { render(cache); mostrado = true; }
    } catch (e) {}

    if (!CONFIG.APPS_SCRIPT_URL) {
      if (!mostrado) estado("Configurá la conexión a Google (js/config.js) para ver el historial.", "");
      return;
    }
    if (!mostrado) estado("Cargando…", "");

    // 2) Refrescar desde el servidor en segundo plano (con reintentos).
    postReintento({ accion: "historial" }, 2).then((out) => {
      if (out && out.ok) {
        render(out.datos || []);
        try { localStorage.setItem("ops_historial", JSON.stringify(out.datos || [])); } catch (e) {}
      } else if (!mostrado) {
        estado("No se pudo cargar el historial. Reintentá con ↻ Actualizar.", "err");
      }
    });
  }

  // ---------- eventos ----------
  $("detalle-close").addEventListener("click", () => ($("detalle").style.display = "none"));
  $("detalle").addEventListener("click", (e) => {
    if (e.target.id === "detalle") $("detalle").style.display = "none";
  });
  $("btn-recargar").addEventListener("click", cargar);
  $("filtro-semana").addEventListener("change", aplicarFiltro);
  $("filtro-familia").addEventListener("change", aplicarFiltro);

  cargar();
})();
