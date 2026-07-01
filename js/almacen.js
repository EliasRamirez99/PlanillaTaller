/* ============================================================
   Lógica de la planilla de Almacén  (sector: Almacen)
   ============================================================ */
(function () {
  "use strict";

  const SECTOR = "Almacen";
  const COLS3 = ["total", "items", "repuestos"];
  const C_INS = ["insumo", "cantidad", "unidad"];
  const C_VEH = ["dominio", "asignacion", "km", "litros"];
  const edicion = leerEdicion();
  const enEd = !!(edicion && edicion.planilla === "Almacen");
  let PANS = []; // pañoleros de la ubicación elegida (para "Ver listado")

  const MOV_ROWS = [
    ["or_cargadas", "OR Cargadas"],
    ["remitos_egreso", "Remitos de Egreso"],
    ["remitos_ingreso", "Remitos de Ingreso"],
  ];
  const TRANSF_ROWS = [
    ["base4", "Base 4"],
    ["720", "720"],
    ["745", "745"],
    ["758", "758"],
    ["760", "760"],
    ["base7", "Base 7"],
  ];

  prepararListados(function () {
    poblarSemanas($("semana"));
    poblarSelect($("ubicacion"), LISTADOS.obras, (o) => o[1], (o) => o[1]);
    enlazarSemana("semana", "desde", "hasta");
    $("ubicacion").addEventListener("change", recalcPanoleros);
    $("ver-panoleros").addEventListener("click", abrirGestionPanoleros);

    construirFilasEtiqueta("tabla-movimientos", MOV_ROWS, COLS3);
    // OR Cargadas: sólo aplica "Total"; deshabilitamos las otras dos columnas.
    const orTr = document.querySelector('#tabla-movimientos tbody tr[data-clave="or_cargadas"]');
    if (orTr) ["items", "repuestos"].forEach((c) => {
      const inp = orTr.querySelector(`input[data-col="${c}"]`);
      if (inp) { inp.disabled = true; inp.value = ""; inp.placeholder = "—"; }
    });
    construirFilasEtiqueta("tabla-transferencias", TRANSF_ROWS, COLS3);
    const recalcTransf = filaTotal("tabla-transferencias", COLS3, "Total");

    const vehCtrl = tablaDinamica("tabla-vehiculos", C_VEH, null, null);
    wireAgregar("add-vehiculos", vehCtrl);

    const insCtrl = tablaDinamica("tabla-insumos", C_INS, null, null);
    wireAgregar("add-insumos", insCtrl);

    const necCtrl = tablaDinamica("tabla-necesidades", ["necesidad", "fecha"], (n) => ($("necesidades_cant").value = n), 33, null, { fecha: "date" });
    wireAgregar("add-necesidades", necCtrl);
    $("prev-necesidades").addEventListener("click", () => {
      const ub = $("ubicacion").value, sem = $("semana").value;
      if (!sem || !ub) { alert("Elegí primero la semana y la ubicación."); return; }
      traerCargaAnterior("Almacen", sem, (s) => s.fila.ubicacion === ub).then((res) => {
        if (!res.semanaAnt) { alert("No hay semana anterior."); return; }
        if (!res.sub) { alert("No se encontró carga de " + ub + " en " + res.semanaAnt + "."); return; }
        const necs = [];
        for (let i = 1; i <= 33; i++) {
          const ne = res.sub.fila["nec" + i];
          if (("" + (ne || "")).trim()) necs.push({ necesidad: ne, fecha: fechaISO(res.sub.fila["necfecha" + i]) });
        }
        if (!necs.length) { alert("La semana anterior no tenía necesidades."); return; }
        llenarDinamica("tabla-necesidades", necCtrl, necs, ["necesidad", "fecha"]);
      });
    });

    if (enEd) prefill(edicion.fila, necCtrl, insCtrl, vehCtrl, recalcTransf);

    conectarForm(recolectar, validar, function () {
      if (enEd) { limpiarEdicion(); alert("✅ Cambios guardados."); location.href = "index.html"; return; }
      $("form").reset();
      $("desde").value = $("hasta").value = "";
      $("necesidades_cant").value = "0";
      recalcTransf();
      PANS = [];
    });
  });

  function recalcPanoleros() {
    const u = norm($("ubicacion").value);
    PANS = (LISTADOS.panoleros || []).filter((p) => norm(p[1]) === u);
    $("cant_panoleros").value = PANS.length;
  }

  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function norm(v) { return String(v == null ? "" : v).trim(); }

  // Gestor editable de pañoleros: arriba los que ya están en este depósito (para
  // sacarlos); abajo, un buscador para sumar del resto. Solo se elige de los existentes.
  function abrirGestionPanoleros() {
    const U = $("ubicacion").value;
    if (!U) { alert("Elegí primero la ubicación (depósito)."); return; }

    const cache = listadosCache();
    const pan = (cache && cache.datos && cache.datos.panoleros) ? cache.datos.panoleros : null;
    if (!pan || !pan.length) { mostrarLista("Pañoleros — " + U, PANS.map((p) => p[0])); return; }

    const enDeposito = (p) => norm(p.fila[1]) === norm(U);

    const html =
      `<h3>Pañoleros — ${esc(U)}</h3>` +
      `<h4 class="mec-h4">En este depósito</h4>` +
      `<div class="status" id="pan-status"></div>` +
      `<table class="grid mec-tabla"><tbody id="pan-asig"></tbody></table>` +
      `<h4 class="mec-h4">Agregar pañolero</h4>` +
      `<p class="modal-nota">Buscá por nombre entre el resto de pañoleros y agregalo a este depósito.</p>` +
      `<input type="text" id="pan-buscar" class="mec-buscar" placeholder="Buscar por nombre…" />` +
      `<table class="grid mec-tabla"><tbody id="pan-resto"></tbody></table>`;
    const body = modalHTML(html);
    const setM = hacerStatus(body.querySelector("#pan-status"));
    const tbAsig = body.querySelector("#pan-asig");
    const tbResto = body.querySelector("#pan-resto");
    const buscar = body.querySelector("#pan-buscar");

    function pintarAsig() {
      const filas = pan.filter(enDeposito);
      tbAsig.innerHTML = filas.length ? filas.map((p) => {
        const panol = norm(p.fila[3]);
        return `<tr data-id="${esc(p.id)}"><td>${esc(p.fila[0] || "")}${panol ? `<div class="mec-cur">${esc(panol)}</div>` : ""}</td>` +
          `<td class="mec-acc"><button type="button" class="ghost small" data-sacar="${esc(p.id)}">✕ Sacar</button></td></tr>`;
      }).join("") : '<tr><td colspan="2"><em>Todavía no hay pañoleros en este depósito.</em></td></tr>';
    }
    function pintarResto(filtro) {
      const f = norm(filtro).toLowerCase();
      if (!f) { tbResto.innerHTML = '<tr><td><em>Escribí un nombre para buscar…</em></td></tr>'; return; }
      const filas = pan.filter((p) => !enDeposito(p) && norm(p.fila[0]).toLowerCase().includes(f));
      tbResto.innerHTML = filas.length ? filas.map((p) => {
        const ubi = norm(p.fila[1]);
        const cur = ubi ? esc(ubi) : "<em>sin depósito</em>";
        return `<tr data-id="${esc(p.id)}"><td>${esc(p.fila[0] || "")}<div class="mec-cur">${cur}</div></td>` +
          `<td class="mec-acc"><button type="button" class="ghost small" data-add="${esc(p.id)}">＋ Agregar</button></td></tr>`;
      }).join("") : '<tr><td colspan="2"><em>Sin resultados.</em></td></tr>';
    }
    function aplicar(id, ubic, ctrl) {
      if (ctrl) ctrl.disabled = true;
      setM("Guardando…", "");
      asignarPanoleroSrv(id, ubic).then(function () {
        const p = pan.find((x) => String(x.id) === String(id));
        const nombre = p ? p.fila[0] : "";
        if (p) p.fila[1] = ubic;
        (LISTADOS.panoleros || []).forEach((arr) => { if (arr[0] === nombre) arr[1] = ubic; });
        try { localStorage.setItem("ops_listados", JSON.stringify(cache)); } catch (e) {}
        recalcPanoleros();
        setM("✅ Guardado.", "ok");
        pintarAsig(); pintarResto(buscar.value);
      }).catch(function () {
        setM("❌ No se pudo guardar. Probá de nuevo.", "err");
        if (ctrl) ctrl.disabled = false;
      });
    }
    pintarAsig(); pintarResto("");
    tbAsig.addEventListener("click", function (ev) { const b = ev.target.closest("button[data-sacar]"); if (!b) return; aplicar(b.getAttribute("data-sacar"), "", b); });
    tbResto.addEventListener("click", function (ev) { const b = ev.target.closest("button[data-add]"); if (!b) return; aplicar(b.getAttribute("data-add"), U, b); });
    buscar.addEventListener("input", function () { pintarResto(this.value); });
  }

  function asignarPanoleroSrv(id, ubicacion) {
    if (!CONFIG.APPS_SCRIPT_URL) return Promise.resolve(); // demo
    return postReintento({ accion: "asignar_panolero", sector: SECTOR, clave: claveSector(), id: id, ubicacion: ubicacion }, 3)
      .then(function (o) { if (!o || !o.ok) throw new Error((o && o.error) || "error"); });
  }

  function setEtiqueta(tbodyId, clave, valsObj) {
    document.querySelectorAll(`#${tbodyId} tbody tr`).forEach((tr) => {
      if (tr.dataset.clave === clave) {
        COLS3.forEach((c) => { const inp = tr.querySelector(`input[data-col="${c}"]`); if (inp) inp.value = valsObj[c] || ""; });
      }
    });
  }

  function prefill(f, necCtrl, insCtrl, vehCtrl, recalcTransf) {
    document.querySelector(".titulo").textContent = "EDITANDO CARGA — ALMACÉN";
    document.querySelector("button.primary").textContent = "Guardar cambios";
    $("semana").value = f.semana || ""; $("semana").dispatchEvent(new Event("change"));
    $("ubicacion").value = f.ubicacion || "";
    recalcPanoleros();
    if (f.cant_panoleros) $("cant_panoleros").value = f.cant_panoleros;

    MOV_ROWS.forEach(([clave]) => {
      setEtiqueta("tabla-movimientos", clave, { total: f[clave + "_total"], items: f[clave + "_items"], repuestos: f[clave + "_repuestos"] });
    });
    TRANSF_ROWS.forEach(([clave]) => {
      setEtiqueta("tabla-transferencias", clave, { total: f["transf_" + clave + "_total"], items: f["transf_" + clave + "_items"], repuestos: f["transf_" + clave + "_repuestos"] });
    });
    recalcTransf();

    const necs = [];
    for (let i = 1; i <= 33; i++) { const ne = f["nec" + i]; if (("" + (ne || "")).trim()) necs.push({ necesidad: ne, fecha: fechaISO(f["necfecha" + i]) }); }
    llenarDinamica("tabla-necesidades", necCtrl, necs, ["necesidad", "fecha"]);

    const ins = [];
    for (let i = 1; i <= 33; i++) {
      const nm = f["ins" + i + "_insumo"], ca = f["ins" + i + "_cantidad"], un = f["insunidad" + i];
      if (("" + (nm || "")).trim() || ("" + (ca || "")).trim() || ("" + (un || "")).trim()) ins.push({ insumo: nm, cantidad: ca, unidad: un });
    }
    llenarDinamica("tabla-insumos", insCtrl, ins, C_INS);

    const vehs = [];
    for (let i = 1; i <= 33; i++) {
      const o = {}; let algo = false;
      C_VEH.forEach((c) => { const v = f["veh" + i + "_" + c]; o[c] = v; if (("" + (v || "")).trim()) algo = true; });
      if (algo) vehs.push(o);
    }
    llenarDinamica("tabla-vehiculos", vehCtrl, vehs, C_VEH);
  }

  function recolectar() {
    const d = {
      sector: SECTOR,
      planilla: "Almacen",
      clave: claveSector(),
      semana: $("semana").value,
      desde: $("desde").value,
      hasta: $("hasta").value,
      ubicacion: $("ubicacion").value,
      cant_panoleros: $("cant_panoleros").value,
      movimientos: leerTablaEtiqueta("tabla-movimientos", COLS3),
      transferencias: leerTablaEtiqueta("tabla-transferencias", COLS3),
      necesidades_cant: $("necesidades_cant").value,
      necesidades: leerTabla("tabla-necesidades", ["necesidad", "fecha"]),
      insumos: leerTabla("tabla-insumos", C_INS),
      vehiculos: leerTabla("tabla-vehiculos", C_VEH),
    };
    if (enEd) { d.accion = "editar_carga"; d.id = edicion.id; }
    return d;
  }

  function validar(d) {
    if (!d.semana) return "Elegí la semana.";
    if (!d.ubicacion) return "Elegí la ubicación.";
    if (faltaFechaEn("tabla-necesidades", ["necesidad"], "fecha")) return "Completá la fecha de pedido en todas las necesidades.";
    return null;
  }
})();
