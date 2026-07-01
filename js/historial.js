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
      filas.push([f[`rep${i}_dominio`] || "", f[`rep${i}_repuesto`] || "", f[`rep${i}_tiempo`] || ""]);
    }
    return tabla(["Dominio", etiqueta || "Repuesto", "Fecha de pedido"], filas);
  }
  function necesidadesDesdeFila(f, n) {
    const filas = [];
    for (let i = 1; i <= n; i++) filas.push([f[`nec${i}`] || ""]);
    return tabla(["Necesidad"], filas);
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
    const nec = necesidadesDesdeFila(f, 33);
    if (nec) h += `<h4>Necesidades</h4>${nec}`;
    return h;
  }

  function detalleEstacionarios(sub) {
    const f = sub.fila;
    let h = campos([["Ubicación", f.ubicacion], ["Pañoleros", f.cant_panoleros]]);
    const filas = (sub.equipos || []).map((e) => [e.equipo, e.total, e.disponible, e.reparacion, e.demora, e.observaciones]);
    const t = tabla(["Equipo", "Total", "Disponible", "Reparación", "Demora", "Observaciones"], filas);
    if (t) h += `<h4>Equipos</h4>${t}`;
    return h;
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
    if (tt) h += `<h4>Transferencias de Base 4 a:</h4>${tt}`;

    const insF = [];
    for (let i = 1; i <= 33; i++) insF.push([f[`ins${i}_insumo`] || "", f[`ins${i}_cantidad`] || ""]);
    const ins = tabla(["Insumo", "Cantidad"], insF);
    if (ins) h += `<h4>Insumos utilizados</h4>${ins}`;

    const rep = repuestosDesdeFila(f, 33, "Repuesto / Obs.");
    if (rep) h += `<h4>Repuestos en espera</h4>${rep}`;
    const nec = necesidadesDesdeFila(f, 33);
    if (nec) h += `<h4>Necesidades</h4>${nec}`;
    return h;
  }

  const PAG = { Supervisores: "supervisores.html", Estacionarios: "estacionarios.html", Almacen: "almacen.html", Campo: "campo.html" };

  function detalleCampo(sub) {
    const f = sub.fila;
    let h = campos([["Supervisor", f.supervisor], ["Referente", f.referente], ["Zona", f.zona]]);
    const to = tabla(["Obra", "Órdenes", "Tareas"], (sub.obras || []).map((o) => [o.obra, o.ordenes, o.tareas]));
    if (to) h += `<h4>Obras</h4>${to}`;
    const tv = tabla(["Dominio", "Asignación", "Km", "Litros"], (sub.vehiculos || []).map((v) => [v.dominio, v.asignacion, v.km, v.litros]));
    if (tv) h += `<h4>Vehículos utilizados</h4>${tv}`;
    const tr = tabla(["Obra", "Repuesto", "Fecha de pedido"], (sub.repuestos || []).map((r) => [r.obra, r.repuesto, r.fecha]));
    if (tr) h += `<h4>Espera de repuestos</h4>${tr}`;
    const tp = tabla(["Obra", "Necesidad"], (sub.pendientes || []).map((p) => [p.obra, p.pendiente]));
    if (tp) h += `<h4>Necesidades</h4>${tp}`;
    return h;
  }

  function abrirDetalle(sub) {
    const f = sub.fila;
    let cuerpo =
      `<h3>${esc(nombrePlanilla(sub.planilla))} <button type="button" class="ghost small" id="det-editar">✎ Editar / corregir</button></h3>` +
      campos([
        ["Cargado", fmtFecha(f.timestamp)],
        ["Semana", f.semana],
        ["Período", formatearFecha(f.desde) + (f.hasta ? " al " + formatearFecha(f.hasta) : "")],
      ]);
    if (sub.planilla === "Supervisores") cuerpo += detalleSupervisores(f);
    else if (sub.planilla === "Estacionarios") cuerpo += detalleEstacionarios(sub);
    else if (sub.planilla === "Almacen") cuerpo += detalleAlmacen(f);
    else if (sub.planilla === "Campo") cuerpo += detalleCampo(sub);

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
      </tr>`;
    }).join("");
    let html = `<table class="grid hist"><thead>
      <tr><th>Cargado</th><th>Planilla</th><th>Semana</th><th>Detalle</th><th></th></tr>
      </thead><tbody>${filas}</tbody></table>`;
    if (items.length > LIMITE) {
      html += `<div class="ver-mas"><button type="button" class="ghost small" id="hist-mas">Ver anteriores (${items.length - LIMITE} más)</button></div>`;
    }
    cont.innerHTML = html;
    cont.querySelectorAll("tbody tr").forEach((tr) => {
      tr.addEventListener("click", () => abrirDetalle(visibles[+tr.dataset.i]));
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
