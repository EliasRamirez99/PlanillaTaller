/* ============================================================
   Lógica de la planilla de Almacén  (sector: Almacen)
   ============================================================ */
(function () {
  "use strict";

  const SECTOR = "Almacen";
  const COLS3 = ["total", "items", "repuestos"];
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
    poblarSelect($("semana"), LISTADOS.semanas, (s) => s[0], (s) => s[0]);
    poblarSelect($("ubicacion"), LISTADOS.obras, (o) => o[1], (o) => o[1]);
    enlazarSemana("semana", "desde", "hasta");
    $("ubicacion").addEventListener("change", recalcPanoleros);
    $("ver-panoleros").addEventListener("click", () =>
      mostrarLista("Pañoleros — " + ($("ubicacion").value || "?"), PANS.map((p) => p[0] + (p[3] ? " (" + p[3] + ")" : ""))));

    construirFilasEtiqueta("tabla-movimientos", MOV_ROWS, COLS3);
    construirFilasEtiqueta("tabla-transferencias", TRANSF_ROWS, COLS3);
    const recalcTransf = filaTotal("tabla-transferencias", COLS3, "Total");

    const necCtrl = tablaDinamica("tabla-necesidades", ["necesidad"], (n) => ($("necesidades_cant").value = n), 33);
    wireAgregar("add-necesidades", necCtrl);
    $("prev-necesidades").addEventListener("click", () => {
      const ub = $("ubicacion").value, sem = $("semana").value;
      if (!sem || !ub) { alert("Elegí primero la semana y la ubicación."); return; }
      traerCargaAnterior("Almacen", sem, (s) => s.fila.ubicacion === ub).then((res) => {
        if (!res.semanaAnt) { alert("No hay semana anterior."); return; }
        if (!res.sub) { alert("No se encontró carga de " + ub + " en " + res.semanaAnt + "."); return; }
        const necs = [];
        for (let i = 1; i <= 33; i++) { const ne = res.sub.fila["nec" + i]; if (("" + (ne || "")).trim()) necs.push({ necesidad: ne }); }
        if (!necs.length) { alert("La semana anterior no tenía necesidades."); return; }
        llenarDinamica("tabla-necesidades", necCtrl, necs, ["necesidad"]);
      });
    });

    if (enEd) prefill(edicion.fila, necCtrl, recalcTransf);

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
    const u = $("ubicacion").value;
    PANS = (LISTADOS.panoleros || []).filter((p) => p[1] === u);
    $("cant_panoleros").value = PANS.length;
  }

  function setEtiqueta(tbodyId, clave, valsObj) {
    document.querySelectorAll(`#${tbodyId} tbody tr`).forEach((tr) => {
      if (tr.dataset.clave === clave) {
        COLS3.forEach((c) => { const inp = tr.querySelector(`input[data-col="${c}"]`); if (inp) inp.value = valsObj[c] || ""; });
      }
    });
  }

  function prefill(f, necCtrl, recalcTransf) {
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
    for (let i = 1; i <= 33; i++) { const ne = f["nec" + i]; if (("" + (ne || "")).trim()) necs.push({ necesidad: ne }); }
    llenarDinamica("tabla-necesidades", necCtrl, necs, ["necesidad"]);
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
      necesidades: leerTabla("tabla-necesidades", ["necesidad"]),
    };
    if (enEd) { d.accion = "editar_carga"; d.id = edicion.id; }
    return d;
  }

  function validar(d) {
    if (!d.semana) return "Elegí la semana.";
    if (!d.ubicacion) return "Elegí la ubicación.";
    return null;
  }
})();
